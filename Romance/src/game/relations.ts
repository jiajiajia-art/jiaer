/* ————— 星光2005 · 娱乐圈关系引擎（纯规则层）—————
 * 在既有「好感(s.rel)」单轴之外，维护多维私人关系：心情/心动/私人信任 +「联系冷落」衰减。
 * 契约：数值推进、边界钳制、冷落衰减、联系冷却与幂等都在此；所有中文维度名、提示、
 * 阈值、衰减与联系参数、每人心动上限全部来自 ContentPool.relations，引擎不写死。
 */
import { RELATIONS, REL_DIM_BY_ID, romanticCapOf } from "../worlds/star2005/content";
import { PEOPLE } from "./data";
import { ROMANCE_ARCS } from "./logic";
import type { GameState } from "./logic";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type RelExt = {
  mood: number; // 近况心情 min~max
  romantic: number; // 心动 0~cap（顾沉/宋时序可达 1000）
  trust: number; // 私人信任 0~100
  lastContactDay: number; // 上次联系日（用于冷落衰减）
};

export const relDimLabel = (id: string): string => REL_DIM_BY_ID[id]?.label ?? id;
export const REL_DIMENSIONS = RELATIONS.dimensions;

/* 单人默认关系（读内容池初值，引擎不写死数字） */
export function blankRel(): RelExt {
  return { mood: RELATIONS.mood.init, romantic: 0, trust: RELATIONS.trust.init, lastContactDay: 0 };
}

/* 补齐所有人物的关系条目（迁移/兜底，幂等） */
export function ensureRelations(existing?: Record<string, RelExt>): Record<string, RelExt> {
  const out: Record<string, RelExt> = { ...(existing ?? {}) };
  for (const p of PEOPLE) if (!out[p.id]) out[p.id] = blankRel();
  return out;
}

/* 读取某人关系（缺省返回空白，不修改状态） */
export function relOf(s: GameState, pid: string): RelExt {
  return s.relations?.[pid] ?? blankRel();
}

/* 冷落衰减：距上次联系超过 coldDays，心情按天回落到 warmFloor（每日推进时调用） */
export function decayRelations(s: GameState): Record<string, RelExt> {
  const M = RELATIONS.mood;
  const src = ensureRelations(s.relations);
  const out: Record<string, RelExt> = {};
  for (const [pid, r] of Object.entries(src)) {
    const idle = s.day - r.lastContactDay;
    if (idle > M.coldDays && r.mood > M.warmFloor) {
      out[pid] = { ...r, mood: clamp(r.mood - M.decayPerDay, M.warmFloor, M.max) };
    } else {
      out[pid] = r;
    }
  }
  return out;
}

export type RelResult = { next: GameState; ok: boolean; msg: string };

/* 好感（沿用既有 s.rel 主轴；天王/资本线上限 1000，其余 100） */
function bumpFriendship(rel: Record<string, number>, pid: string, d: number): Record<string, number> {
  const cap = pid === "guchen" || pid === "songshixu" ? 1000 : 100;
  return { ...rel, [pid]: clamp((rel[pid] ?? 0) + d, 0, cap) };
}

/* 是否为需要长线经营的固定角色（有七段情感线者更难攻略） */
export const hasArc = (pid: string): boolean => !!ROMANCE_ARCS[pid];

/* 显示名：优先调用方传入，其次 PEOPLE 登记，最后回退 id */
function displayName(pid: string, name?: string): string {
  return name ?? PEOPLE.find((p) => p.id === pid)?.name ?? pid;
}

/* 动作：主动私下联系（问候/约见）——回暖心情、推进好感/信任/心动。任何人都可攻略。 */
export function contactPerson(s: GameState, pid: string, name?: string): RelResult {
  if (s.npcLives?.[pid]?.dead) return { next:s, ok:false, msg:"该人物已故。" };
  const C = RELATIONS.contact;
  const relations = ensureRelations(s.relations);
  const r = relations[pid] ?? blankRel();
  if (s.day - r.lastContactDay < C.cooldownDays) {
    return { next: s, ok: false, msg: `⏳ ${C.labels.cooldown}` };
  }
  const cap = romanticCapOf(pid);
  const isDating = s.dating === pid;
  const romanticGain = s.romanceEnabled?.[pid] === false ? 0 : C.romanticCasual + (isDating ? C.romanticIfDating : 0);
  const relief = C.stressRelief + (isDating ? C.stressReliefDating : 0);
  const next: RelExt = {
    mood: clamp(r.mood + C.moodLift, RELATIONS.mood.min, RELATIONS.mood.max),
    trust: clamp(r.trust + C.trust, RELATIONS.trust.min, RELATIONS.trust.max),
    romantic: clamp(r.romantic + romanticGain, 0, cap),
    lastContactDay: s.day,
  };
  const nextState: GameState = {
    ...s,
    stress: clamp(s.stress - relief, 0, 100),
    rel: bumpFriendship(s.rel, pid, C.friendship),
    relations: { ...relations, [pid]: next },
  };
  const done = C.labels.done.replace("{name}", displayName(pid, name));
  return {
    next: nextState,
    ok: true,
    msg: `${done}：好感 +${C.friendship}、私人信任 +${C.trust}、心情 +${C.moodLift}、心动 +${romanticGain}、压力 -${relief}${isDating ? "（恋人陪伴）" : ""}。`,
  };
}

/* 表白门槛（普通 NPC）：好感与心动同时达标；固定角色走七段线不在此判定 */
export function canConfess(s: GameState, pid: string): { ok: boolean; reason: "disabled" | "arc" | "dating" | "low" | "ready" } {
  if (s.npcLives?.[pid]?.dead || s.romanceEnabled?.[pid] === false) return { ok: false, reason: "disabled" };
  if (hasArc(pid)) return { ok: false, reason: "arc" };
  if (s.dating === pid) return { ok: false, reason: "dating" };
  const F = RELATIONS.confess;
  const friendship = s.rel?.[pid] ?? 0;
  const romantic = relOf(s, pid).romantic;
  if (friendship >= F.friendshipMin && romantic >= F.romanticMin) return { ok: true, reason: "ready" };
  return { ok: false, reason: "low" };
}

/* 动作：向普通 NPC 表白（轻量攻略路径）——达标即确认关系 */
export function confessTo(s: GameState, pid: string, name?: string): RelResult {
  const L = RELATIONS.confess.labels;
  const who = displayName(pid, name);
  const chk = canConfess(s, pid);
  if (!chk.ok) {
    const msg = chk.reason === "disabled" ? "该人物已设为不可攻略。" : chk.reason === "arc" ? `${L.hardLocked}` : chk.reason === "dating" ? `${L.alreadyDating}` : `${L.locked}`;
    return { next: s, ok: false, msg };
  }
  const nextState: GameState = { ...s, dating: pid };
  return { next: nextState, ok: true, msg: `${L.done.replace("{name}", who)}。` };
}
