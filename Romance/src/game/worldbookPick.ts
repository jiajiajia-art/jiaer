/* ————— 世界书检索（对标 SillyTavern Lore，规则更规整）—————
 * 1. 注入模式：keyword 检索命中（默认）· constant 每轮全局 · once 一次性（注入后标记消耗，不再触发）
 * 2. 有效期：触发后持续 N 轮，到期自动失效（轮 = 已完成的 AI 回合数）
 * 3. 依赖（新）：挂本作品地点 / 人物；玩家在该地点、人物在场、或关键词命中 → 注入（OR）
 * 4. 旧绑定：无 bindRooms/bindNpcs 时仍按 scope 全局 / 单角色 / 单房间 + 模式
 * 5. 互斥组：同组只注入一条——已在有效期内的优先，其次得分最高
 * 6. 检索权重：得分 = 命中的最长关键词长度 × 权重；短词若只出现在更长的已命中关键词内部不算命中
 * 纯函数：本文件只「选」，不改存档；主剧情回合成功后由 commitWorldBook 记账。 */
import type { GameState, WorldBookEntry, WorldBookMem, WorldBookMode } from "../lib/types";
import { asTrimmedString } from "../lib/asTrimmedString";
import { keywordTexts } from "../lib/worldBookKeywords";
import { worldBookDepHit, worldBookHasDeps } from "../lib/worldBookDeps";
import { getWorldRooms } from "../mods/registry";
import { pathOf } from "./roomTree";

export type WorldBookCtx = { npcIds?: string[] };
export type WorldBookPick = { entries: WorldBookEntry[]; fired: string[]; round: number };

export const modeOf = (e: WorldBookEntry): WorldBookMode =>
  e.mode ?? (e.constant || keywordTexts(e.keywords).length === 0 ? "constant" : "keyword");

/* 当前轮次：已成功落地的 AI 回合数 */
export const wbRound = (g: GameState) => g.story.filter((t) => t.role === "ai" && !t.error).length;

const isWordy = (k: string) => /^[a-z0-9_\- ]+$/i.test(k);
/* 关键词在文本里的全部出现位置；纯英文/数字关键词要求词边界，避免 "art" 命中 "start" */
function occurrences(hay: string, key: string): [number, number][] {
  const out: [number, number][] = [];
  if (!key) return out;
  let i = hay.indexOf(key);
  while (i >= 0) {
    const end = i + key.length;
    const ok = !isWordy(key) || (!/[a-z0-9_]/i.test(hay[i - 1] ?? "") && !/[a-z0-9_]/i.test(hay[end] ?? ""));
    if (ok) out.push([i, end]);
    i = hay.indexOf(key, i + 1);
  }
  return out;
}

/** 功能注释：旧 scope——无新依赖时沿用；global / 未选具体对象视为全局 */
function legacyInScope(e: WorldBookEntry, g: GameState, ctx: WorldBookCtx): boolean {
  if (!e.scope || e.scope === "global" || !e.scopeId) return true;
  if (e.scope === "npc") return !!ctx.npcIds?.includes(e.scopeId);
  const room = g.sim?.room;
  return !!room && (room === e.scopeId || pathOf(getWorldRooms(), room).includes(e.scopeId));
}

/** 功能注释：挂靠地点（当前点或其路径祖先）或挂靠人物在场 */
export function worldBookDepsMatch(e: WorldBookEntry, g: GameState, ctx: WorldBookCtx = {}): boolean {
  const room = g.sim?.room;
  // 功能注释：子地点也算身处挂靠点——把当前点的祖先链交给纯函数判定
  return worldBookDepHit(e, {
    room,
    roomPath: room ? pathOf(getWorldRooms(), room) : [],
    npcIds: ctx.npcIds,
  });
}

export function pickWorldBook(g: GameState, book: WorldBookEntry[], hayRaw: string, ctx: WorldBookCtx = {}, rnd: () => number = Math.random): WorldBookPick {
  const round = wbRound(g);
  const mem: WorldBookMem = g.wbMem ?? {};
  const used = new Set(mem.used ?? []);
  const hay = hayRaw.toLowerCase();
  const live = book.filter((e) => e.enabled && asTrimmedString(e.content));

  // 所有关键词的命中区间（用于「长词优先」：被更长命中词完全覆盖的短词出现不算数）
  const spans: { e: string; k: string; s: number; t: number }[] = [];
  for (const e of live) for (const k0 of keywordTexts(e.keywords)) {
    const k = k0.toLowerCase();
    for (const [s, t] of occurrences(hay, k)) spans.push({ e: e.id, k, s, t });
  }
  const shadowed = (x: { k: string; s: number; t: number }) => spans.some((y) => y.k.length > x.k.length && y.s <= x.s && y.t >= x.t);
  const scoreOf = (e: WorldBookEntry) => {
    const best = Math.max(0, ...spans.filter((x) => x.e === e.id && !shadowed(x)).map((x) => x.k.length));
    return best * ((e.weight ?? 100) / 100);
  };

  type Cand = { e: WorldBookEntry; score: number; active: boolean; fresh: boolean };
  const cands: Cand[] = [];
  for (const e of live) {
    const m = modeOf(e);
    const active = (mem.until?.[e.id] ?? -1) > round; // 仍在有效期内：不必再命中
    if (active) { cands.push({ e, score: Infinity, active, fresh: false }); continue; }
    if (m === "once" && used.has(e.id)) continue;

    const hasDeps = worldBookHasDeps(e);
    const score = scoreOf(e);
    const kwHit = score > 0;
    const onceEmpty = m === "once" && keywordTexts(e.keywords).length === 0;

    if (hasDeps) {
      // 新规则：地点 / 人物在场 / 关键词（任一）
      const depHit = worldBookDepsMatch(e, g, ctx);
      if (!depHit && !kwHit && !onceEmpty) continue;
      const prob = e.probability ?? 100;
      if (prob < 100 && rnd() * 100 >= prob) continue;
      cands.push({ e, score: depHit && !kwHit ? 1e5 : score || 1, active: false, fresh: true });
      continue;
    }

    // 旧条目：先过 scope，再按 constant / keyword / once
    if (!legacyInScope(e, g, ctx)) continue;
    if (m === "constant") { cands.push({ e, score: 1e6, active: false, fresh: true }); continue; }
    const hit = kwHit || onceEmpty;
    if (!hit) continue;
    const prob = e.probability ?? 100;
    if (prob < 100 && rnd() * 100 >= prob) continue;
    cands.push({ e, score: score || 1, active: false, fresh: true });
  }

  // 互斥组：每组只留一条（有效期内的 > 得分高的 > order 小的）
  const rank = (a: Cand, b: Cand) => b.score - a.score || (a.e.order ?? 100) - (b.e.order ?? 100);
  const byGroup = new Map<string, Cand>();
  const picked: Cand[] = [];
  for (const c of [...cands].sort(rank)) {
    const gk = c.e.group?.trim();
    if (!gk) { picked.push(c); continue; }
    if (byGroup.has(gk)) continue;
    byGroup.set(gk, c);
    picked.push(c);
  }
  picked.sort((a, b) => (a.e.order ?? 100) - (b.e.order ?? 100) || rank(a, b));
  return { entries: picked.map((c) => c.e), fired: picked.filter((c) => c.fresh).map((c) => c.e.id), round };
}

/* 回合成功落地后记账：一次性条目标记消耗；设了有效期的记下到期轮次 */
export function commitWorldBook(g: GameState, pick: WorldBookPick | undefined, book: WorldBookEntry[]): GameState {
  if (!pick?.fired.length) return g;
  const mem: WorldBookMem = { used: [...(g.wbMem?.used ?? [])], until: { ...(g.wbMem?.until ?? {}) } };
  for (const id of pick.fired) {
    const e = book.find((x) => x.id === id);
    if (!e) continue;
    if (modeOf(e) === "once" && !mem.used!.includes(id)) mem.used!.push(id);
    if ((e.duration ?? 0) > 1) mem.until![id] = pick.round + e.duration!;
  }
  // 清理已过期的记录
  for (const [id, r] of Object.entries(mem.until!)) if (r <= pick.round) delete mem.until![id];
  return { ...g, wbMem: mem };
}
