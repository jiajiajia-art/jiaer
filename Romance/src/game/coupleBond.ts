import type { GameState } from "../lib/types";
import { ensureRelations, blankRel } from "./relations";
import { RELATIONS, romanticCapOf } from "../worlds/star2005/content";
import { syncSimToPlayer } from "../lib/store";
import { canRomance } from "./logic";

/* 情侣空间 × 关系数值：确定性结算（不交给 AI）。
 * 每类互动每个游戏日只结算一次（ledger 记在情侣空间存档里），同时视为「联系过」，避免冷落衰减。 */
export type BondKind = "invite" | "letter" | "qa" | "anniv";

const GAIN: Record<BondKind, { romantic: number; trust: number; mood: number; friendship: number }> = {
  invite: { romantic: 4, trust: 3, mood: 6, friendship: 3 }, // 接受绑定
  letter: { romantic: 2, trust: 1, mood: 4, friendship: 2 }, // 收到回信
  qa: { romantic: 1, trust: 2, mood: 2, friendship: 1 }, // 双方都答完一道题
  anniv: { romantic: 3, trust: 1, mood: 8, friendship: 2 }, // 纪念日当天一起过
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function applyBond(g: GameState, pid: string, kind: BondKind): { next: GameState; note: string } {
  const s = g.sim;
  const relations = ensureRelations(s.relations);
  const r = relations[pid] ?? blankRel();
  const d = GAIN[kind];
  const next = {
    ...r,
    romantic: canRomance(s, pid) ? clamp(r.romantic + d.romantic, 0, romanticCapOf(pid)) : r.romantic, // 不可攻略：羁绊只暖好感与信任
    trust: clamp(r.trust + d.trust, RELATIONS.trust.min, RELATIONS.trust.max),
    mood: clamp(r.mood + d.mood, RELATIONS.mood.min, RELATIONS.mood.max),
    lastContactDay: s.day,
  };
  const f0 = s.rel?.[pid] ?? 0;
  const rel = { ...s.rel, [pid]: clamp(f0 + d.friendship, -100, Math.max(100, f0)) }; // 个别角色好感上限高于 100，不压低
  const parts = [
    next.romantic > r.romantic && `爱慕 +${next.romantic - r.romantic}`,
    rel[pid] > f0 && `好感 +${rel[pid] - f0}`,
    next.trust > r.trust && `信任 +${next.trust - r.trust}`,
    next.mood > r.mood && `心情 +${next.mood - r.mood}`,
  ].filter(Boolean);
  return { next: syncSimToPlayer({ ...g, sim: { ...s, rel, relations: { ...relations, [pid]: next } } }), note: parts.join(" · ") };
}
