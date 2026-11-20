/**
 * 记忆生命周期（纯函数）：决策写入 → 遗忘曲线 → 巩固 / 晋升 → 每日归并。
 * · 决策写入：ADD / UPDATE / DELETE / NOOP；UPDATE 与 DELETE 不物理删除，而是双时态失效（invalidAt + supersededBy），
 *   旧事实保留可追溯，但不再注入提示词；
 * · 遗忘：艾宾浩斯保持率 R = e^(-Δt / S)，稳定度 S 由重要度决定，每次被召回都会延长（间隔重复）；
 * · 巩固：被反复召回或重要度≥2 且过夜的事件晋升为长期记忆；前几天的琐碎日常归并成一条「当日经过」，降低检索噪声。
 */
import { textSimilarity } from "./retrieval.ts";

export type MemTier = "mid" | "long";
export type LifecycleItem = {
  id: string;
  day: number;
  text: string;
  who: string[];
  room?: string;
  imp: 1 | 2 | 3;
  keys?: string[];
  time?: string;
  kind?: "event" | "digest";
  tier?: MemTier;
  recalls?: number;
  lastRecall?: number;
  invalidAt?: number;
  supersededBy?: string;
};
export type WriteOp = "ADD" | "UPDATE" | "DELETE" | "NOOP";
export type WriteCandidate = { text: string; who: string[]; op?: "add" | "update" | "delete"; replaces?: string };
export type WriteDecision = { op: WriteOp; target?: string };

const STABILITY: Record<1 | 2 | 3, number> = { 1: 4, 2: 21, 3: 120 };
/** 推翻旧事实的常见措辞：同一主体 + 这些词 → 视为更新而非新增 */
const CHANGE_CUE = /不再|再也不|改为|改成|换成|已经不|不是.*了|分手|和好|离开了|搬到|搬去|辞职|取消|作废|其实|原来|撤回|反悔|恢复了|修好了|坏了/;

export const isValid = (e: LifecycleItem) => e.invalidAt == null;

export function stability(e: LifecycleItem): number {
  return STABILITY[e.imp] * (1 + 0.8 * (e.recalls ?? 0));
}

/** 艾宾浩斯保持率（0~1）；以最近一次发生 / 被召回为起点 */
export function retention(e: LifecycleItem, now: number): number {
  const ref = Math.max(e.day, e.lastRecall ?? e.day);
  return Math.exp(-Math.max(0, now - ref) / stability(e));
}

export function decideWrite(valid: LifecycleItem[], c: WriteCandidate): WriteDecision {
  const pool = valid.slice(-200);
  const best = (text: string) => {
    let hit: LifecycleItem | undefined;
    let s = 0;
    for (const e of pool) {
      const v = textSimilarity(text, e.text);
      if (v > s) { s = v; hit = e; }
    }
    return { hit, s };
  };
  if (c.replaces?.trim()) {
    const { hit, s } = best(c.replaces);
    if (hit && s >= 0.35) return { op: c.op === "delete" ? "DELETE" : "UPDATE", target: hit.id };
    if (c.op === "delete") return { op: "NOOP" };
  }
  const { hit, s } = best(c.text);
  if (hit && s >= 0.9) return { op: "NOOP", target: hit.id };
  if (hit && s >= 0.35 && CHANGE_CUE.test(c.text)) {
    const shared = c.who.some((w) => hit.who.includes(w)) || (!c.who.length && !hit.who.length);
    if (shared) return { op: "UPDATE", target: hit.id };
  }
  return { op: "ADD" };
}

/** 被注入（召回）一次：间隔重复，延长稳定度 */
export function reinforce<T extends LifecycleItem>(items: T[], ids: Set<string>, now: number): T[] {
  if (!ids.size) return items;
  return items.map((e) => (ids.has(e.id) && e.lastRecall !== now ? { ...e, recalls: (e.recalls ?? 0) + 1, lastRecall: now } : e));
}

/** 晋升长期：重要且已过夜，或被召回≥2 次 */
export function promote<T extends LifecycleItem>(items: T[], now: number): T[] {
  return items.map((e) => (e.tier !== "long" && isValid(e) && ((e.imp >= 2 && now > e.day) || (e.recalls ?? 0) >= 2) ? { ...e, tier: "long" as const } : e));
}

/**
 * 每日归并：已经过去的某一天若有 ≥3 条从未被召回的日常（imp=1），合成一条「当日经过」，
 * 原条目移除——细节已在长期摘要里，归并后检索更干净。
 */
export function digestPastDays<T extends LifecycleItem>(items: T[], now: number, make: (day: number, parts: T[]) => T): T[] {
  const byDay = new Map<number, T[]>();
  for (const e of items) {
    if (e.day >= now - 1 || e.imp !== 1 || e.kind === "digest" || !isValid(e) || (e.recalls ?? 0) > 0) continue;
    (byDay.get(e.day) ?? byDay.set(e.day, []).get(e.day)!).push(e);
  }
  let out = items;
  for (const [day, parts] of byDay) {
    if (parts.length < 3) continue;
    const drop = new Set(parts.map((p) => p.id));
    const at = out.findIndex((e) => drop.has(e.id));
    const rest = out.filter((e) => !drop.has(e.id));
    rest.splice(Math.min(at, rest.length), 0, make(day, parts));
    out = rest;
  }
  return out;
}

/** 遗忘：清掉失效已久的旧版本，以及保持率极低、从未被用到的琐事（最近 40 条不动） */
export function forget<T extends LifecycleItem>(items: T[], now: number): T[] {
  const keepFrom = Math.max(0, items.length - 40);
  return items.filter((e, i) => {
    if (i >= keepFrom) return true;
    if (e.invalidAt != null) return now - e.invalidAt < 30;
    if (e.imp === 1 && !(e.recalls ?? 0) && e.kind !== "digest") return retention(e, now) >= 0.02;
    return true;
  });
}
