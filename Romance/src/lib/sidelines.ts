/* 支线判定（纯函数，不依赖 registry，便于单测）：
 * 每天结束、主线结算之后逐条判定——未出现的看触发条件，进行中的先判失败（含超时）再判完成。
 * 进度只写 side:* 系列 flags，绝不碰 quest:* —— 支线成败不影响主线完成 / 中断。 */
import type { FixedCond, FixedEffect, Sideline, SideState } from "./types";

type Flags = Record<string, number>;
type SideSrc = { flags?: Flags; day?: number };

export const SIDE_STATE_LABEL: Record<SideState, string> = { pending: "未出现", active: "进行中", done: "已完成", failed: "已失败" };

export const sideFlag = (id: string) => `side:${id}`;
export const sideDoneFlag = (id: string) => `sideDone:${id}`;
export const sideAtFlag = (id: string) => `sideAt:${id}`;

const flag = (s: SideSrc, k: string) => s.flags?.[k] ?? 0;

/** 支线当前状态：进行中 / 已失败以本轮为准；done = 曾完成过（可重复支线完成后回到未出现也算 done） */
export function sideState(id: string, s: SideSrc): SideState {
  const f = flag(s, sideFlag(id));
  if (f === 2) return "active";
  if (f < 0) return "failed";
  if (f === 1 || flag(s, sideDoneFlag(id)) > 0) return "done";
  return "pending";
}

/** 旧作品 / AI 补丁：非数组当空数组；缺 id 或名字的条目丢弃，条件与奖励统一收成数组 */
export function normalizeSidelines(raw: unknown): Sideline[] {
  if (!Array.isArray(raw)) return [];
  const arr = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) && v.length ? (v as T[]) : undefined);
  return raw.flatMap((x): Sideline[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (!id) return [];
    const limit = Number(r.limitDays);
    return [{
      ...(r as Sideline),
      id,
      name: typeof r.name === "string" ? r.name : "",
      trigger: arr<FixedCond>(r.trigger),
      conds: arr<FixedCond>(r.conds),
      failConds: arr<FixedCond>(r.failConds),
      rewards: arr<FixedEffect>(r.rewards),
      failRewards: arr<FixedEffect>(r.failRewards),
      unlockIds: arr<string>(r.unlockIds),
      failUnlockIds: arr<string>(r.failUnlockIds),
      limitDays: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined,
    }];
  });
}

export type SideDeps<S> = {
  condsMet: (conds: FixedCond[] | undefined, s: S, match?: "all" | "any") => boolean;
  evalCond: (c: FixedCond, s: S) => boolean;
  applyEffects: (s: S, effects: FixedEffect[] | undefined) => { next: S; changes: string[] };
};

/** 每天结束结算支线：出现 → 失败 / 完成；完成发奖励、记完成次数、激活事件 */
export function applySidelines<S extends SideSrc & { eventsUnlocked?: string[] }>(
  s: S,
  lines: Sideline[] | undefined,
  deps: SideDeps<S>,
): { next: S; changes: string[] } {
  let next = s;
  const changes: string[] = [];
  const setFlags = (p: Flags) => { next = { ...next, flags: { ...(next.flags ?? {}), ...p } }; };
  const unlock = (ids?: string[]) => { if (ids?.length) next = { ...next, eventsUnlocked: Array.from(new Set([...(next.eventsUnlocked ?? []), ...ids])) }; };
  const reward = (effects?: FixedEffect[]) => {
    if (!effects?.length) return [];
    const res = deps.applyEffects(next, effects);
    next = res.next;
    return res.changes;
  };
  for (const line of lines ?? []) {
    if (line.enabled === false || !line.id) continue;
    const name = line.name || line.id;
    let f = flag(next, sideFlag(line.id));
    // 只触发一次的支线：完成 / 失败后不再出现
    if (f === 1 || (f < 0 && !line.repeat)) continue;
    if (f !== 2) {
      if (!deps.condsMet(line.trigger, next, "all")) continue;
      setFlags({ [sideFlag(line.id)]: 2, [sideAtFlag(line.id)]: next.day ?? 0 });
      f = 2;
      changes.push(`支线「${name}」出现`);
    }
    const overdue = !!line.limitDays && (next.day ?? 0) - flag(next, sideAtFlag(line.id)) >= line.limitDays;
    if (overdue || (line.failConds?.length && line.failConds.some((c) => deps.evalCond(c, next)))) {
      setFlags({ [sideFlag(line.id)]: line.repeat ? 0 : -1 });
      unlock(line.failUnlockIds);
      const got = reward(line.failRewards);
      changes.push(`支线「${name}」失败${overdue ? "（超时）" : ""}${got.length ? "：" + got.join("、") : ""}`);
      continue;
    }
    if (!line.conds?.length || !deps.condsMet(line.conds, next, line.match)) continue;
    setFlags({ [sideFlag(line.id)]: line.repeat ? 0 : 1, [sideDoneFlag(line.id)]: flag(next, sideDoneFlag(line.id)) + 1 });
    unlock(line.unlockIds);
    const got = reward(line.rewards);
    changes.push(`支线「${name}」完成${got.length ? "：" + got.join("、") : ""}`);
  }
  return { next, changes };
}

/** 玩家可见的支线：隐藏支线触发前不出现；停用的不出现 */
export function visibleSidelines(lines: Sideline[] | undefined, s: SideSrc): { line: Sideline; state: SideState }[] {
  return (lines ?? [])
    .filter((l) => l.enabled !== false && l.id)
    .map((line) => ({ line, state: flag(s, sideFlag(line.id)) === 2 ? ("active" as const) : sideState(line.id, s) }))
    .filter(({ line, state }) => !(line.hidden && state === "pending"));
}

/** 给 AI 的支线摘要：只报进行中的支线，剧情可顺带推进，但支线成败由代码判定 */
export function sidelineBrief(lines: Sideline[] | undefined, s: SideSrc): string {
  return visibleSidelines(lines, s)
    .filter((x) => x.state === "active")
    .map(({ line }) => `【支线·${line.name || line.id}】进行中${line.desc ? `——${line.desc}` : ""}`)
    .join("\n");
}
