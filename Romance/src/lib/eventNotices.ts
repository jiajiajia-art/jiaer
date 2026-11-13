import type { FixedEvent } from "./types";

/**
 * 功能注释：特殊事件进支线。
 * 触发后不立刻另起一段剧情，而是在支线里给玩家一条：事件名 · 发生了什么 · 剩余时限，并在对应地点亮「!」。
 * - 填了时限（limitDays）：按天倒计时，到 0 记为失败（结算 failEffects）。
 * - 没填时限：只在触发的这一回合可展开；下回合开始时标灰「已过期」，事件本身的数值照常结算（不写剧情）。
 * 玩家点开才演绎剧情，数值在那一刻结算。
 */
export type EventNotice = {
  id: string;
  kind: "event" | "quest";
  refId: string;
  name: string;
  summary: string;
  room?: string;
  createdTurn: number;
  createdDay: number;
  limitDays?: number;
  status: "open" | "played" | "expired" | "failed";
  endedDay?: number;
};

type NoticeHost = { eventNotices?: EventNotice[]; turnCount: number; sim: { day?: number } };

/** 功能注释：事件发生地——地点进入触发的房间 → 条件里的「当前地点 / 去过」→ 触发时主角所在地 */
export function noticeRoomOf(ev: Pick<FixedEvent, "trigger" | "conds">, curRoom?: string): string | undefined {
  if (ev.trigger?.kind === "enter" && ev.trigger.room) return ev.trigger.room;
  const c = (ev.conds ?? []).find((x) => x.kind === "location" || x.kind === "visited") as { key?: string } | undefined;
  return c?.key || curRoom || undefined;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function makeEventNotice(
  host: NoticeHost,
  src: { kind: EventNotice["kind"]; refId: string; name: string; summary?: string; room?: string; limitDays?: number },
  id: string,
): EventNotice {
  const lim = src.limitDays && src.limitDays > 0 ? Math.round(src.limitDays) : undefined;
  return {
    id,
    kind: src.kind,
    refId: src.refId,
    name: src.name || "特殊事件",
    summary: clip((src.summary || "").replace(/\s+/g, " ").trim() || src.name || "", 80),
    room: src.room,
    createdTurn: host.turnCount,
    createdDay: host.sim.day ?? 0,
    limitDays: lim,
    status: "open",
  };
}

/** 功能注释：剩余天数（仅限时条目）；未限时返回 null */
export function noticeDaysLeft(n: EventNotice, day: number): number | null {
  if (!n.limitDays) return null;
  return Math.max(0, n.createdDay + n.limitDays - day);
}

/**
 * 功能注释：回合 / 日期推进后检查到期——返回需要结算的条目（expired 结算事件本身数值；failed 结算失败后果）。
 * 纯函数：只改状态，不碰数值；数值由调用方按返回列表结算。
 */
export function tickEventNotices<T extends NoticeHost>(g: T): { g: T; expired: EventNotice[]; failed: EventNotice[] } {
  const day = g.sim.day ?? 0;
  const expired: EventNotice[] = [], failed: EventNotice[] = [];
  let changed = false;
  const list = (g.eventNotices ?? []).map((n) => {
    if (n.status !== "open") return n;
    if (n.limitDays) {
      if (day - n.createdDay >= n.limitDays) { changed = true; const x = { ...n, status: "failed" as const, endedDay: day }; failed.push(x); return x; }
      return n;
    }
    if (g.turnCount > n.createdTurn) { changed = true; const x = { ...n, status: "expired" as const, endedDay: day }; expired.push(x); return x; }
    return n;
  });
  return { g: changed ? { ...g, eventNotices: list } : g, expired, failed };
}

/** 功能注释：写进下一回合提示词——上回合后发生的事（属性升档 / 抵达 / 插入事件）+ 当前可展开的特殊事件 */
export function nextTurnCueBlock(cues: string[] | undefined, notices: EventNotice[] | undefined, day: number, placeName: (room?: string) => string): string {
  const lines: string[] = [];
  if (cues?.length) lines.push("【上回合之后发生的事（请在本回合自然带出，不要另起一段）】", ...cues.map((c) => `- ${c}`));
  const open = (notices ?? []).filter((n) => n.status === "open");
  if (open.length) {
    lines.push("【当前可展开的特殊事件（只能暗示或提及，不得替玩家展开；玩家在支线里选择后才会演绎）】");
    for (const n of open) {
      const left = noticeDaysLeft(n, day);
      lines.push(`- ${n.name}${n.room ? `（${placeName(n.room)}）` : ""}：${n.summary}${left != null ? `；剩 ${left} 天` : "；仅本回合"}`);
    }
  }
  return lines.join("\n");
}
