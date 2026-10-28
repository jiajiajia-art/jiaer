/* 阵营派系：声望存于 sim.flags["faction:<id>"]（-100~100，未写过 = 0，主线 / 结局 / 事件条件都能读）。
 * 定义随存档（GameState.factions），这里同步一份到模块，供纯函数引擎（效果结算 / 购物）查阅。 */
import type { Faction, FactionStance, GameState, WorldBookEntry } from "../lib/types";
import type { GameState as SimState } from "./logic";
import { clampAffinity, engineRules } from "./engineRules";

/* 本模块被 logic.ts 引用，不得静态依赖 mods/registry（会形成循环导入，世界内容提前求值）。
 * 地点层级由上层注入。 */
let roomPath: (id: string) => string[] = (id) => (id ? [id] : []);
export function setFactionRoomPath(f: (id: string) => string[]) { roomPath = f; }

let live: { list: Faction[]; lore: boolean } = { list: [], lore: false };
/** 读档 / 改动阵营后同步（在 persist 与读档时调用） */
export function syncFactions(g: Pick<GameState, "factions" | "factionMode"> | null | undefined) {
  live = { list: g?.factions ?? [], lore: false }; // 数值与世界书关键词始终同时生效（旧存档的 lore 设置不再区分）
}
export const liveFactions = () => live.list;
export const factionLoreOnly = () => live.lore;

export const factionFlag = (id: string) => `faction:${id}`;
export const REP_MIN = -100, REP_MAX = 100;
export const repOf = (s: Pick<SimState, "flags">, id: string) => s.flags?.[factionFlag(id)] ?? 0;

export const STANCE_LABEL: Record<FactionStance, string> = { core: "核心", member: "成员", ally: "亲近" };
/* 声望变动波及成员好感的比例 */
export const STANCE_SPILL: Record<FactionStance, number> = { core: 0.5, member: 0.3, ally: 0.15 };

export function repTier(v: number): string {
  return v >= 60 ? "尊敬" : v >= 25 ? "友善" : v > -25 ? "中立" : v > -60 ? "冷淡" : "敌视";
}

/** 声望 → 价格倍率：+100 打 8 折，-100 贵 1.5 倍，中立原价 */
export const repPriceMult = (rep: number) => (rep >= 0 ? 1 - 0.2 * (rep / 100) : 1 + 0.5 * (-rep / 100));

/** 在某地点购物的价格倍率（地点属于多个阵营时取乘积；lore 模式不做数值运算 = 1） */
export function priceMultAt(s: Pick<SimState, "flags">, roomPath: string[]): number {
  if (live.lore || !engineRules().attrs.numeric) return 1;
  let m = 1;
  for (const f of live.list) if (f.rooms?.some((r) => roomPath.includes(r))) m *= repPriceMult(repOf(s, f.id));
  return Math.max(0.1, m);
}

/** 主角此刻所在地点的成交价（按阵营声望调价，取整，至少 1） */
export const shopPrice = (s: Pick<SimState, "flags" | "room">, base: number) =>
  Math.max(1, Math.round(base * priceMultAt(s, roomPath(s.room))));

/** 结算一次声望变动：写声望并按立场波及成员好感；返回变动说明。lore 模式什么也不做 */
export function applyFactionDelta(next: SimState, id: string, delta: number, changes: string[]) {
  if (live.lore || !delta || !engineRules().attrs.numeric) return;
  const f = live.list.find((x) => x.id === id);
  const k = factionFlag(id);
  next.flags = { ...(next.flags ?? {}) };
  next.flags[k] = Math.max(REP_MIN, Math.min(REP_MAX, (next.flags[k] ?? 0) + delta));
  changes.push(`${f?.name ?? id}声望 ${delta > 0 ? "+" : ""}${delta}`);
  // 底层规则「声望传播」关闭时，只改声望、不波及同阵营成员
  if (!engineRules().faction.spread) return;
  next.rel = { ...(next.rel ?? {}) };
  for (const m of f?.members ?? []) {
    const d = Math.round(delta * STANCE_SPILL[m.stance]);
    if (!d) continue;
    next.rel[m.npc] = clampAffinity((next.rel[m.npc] ?? 0) + d, m.npc).v;
  }
}

/** NPC 所属阵营（含立场） */
export const factionsOf = (npc: string) =>
  live.list.flatMap((f) => f.members?.filter((m) => m.npc === npc).map((m) => ({ f, stance: m.stance })) ?? []);

/** 阵营 → 世界书条目（虚拟，不写进玩家的世界书）：关键词 = 阵营名 + 标签；
 *  full 模式正文附带当前声望与成员立场，lore 模式只给设定与成员，不出现任何数值 */
export function factionLoreEntries(g: GameState): WorldBookEntry[] {
  const lore = false;
  return (g.factions ?? []).filter((f) => f.name.trim()).map((f) => {
    const members = (f.members ?? []).map((m) => `${g.npcs.find((n) => n.id === m.npc)?.name ?? m.npc}（${STANCE_LABEL[m.stance]}）`).join("、");
    const rep = repOf(g.sim, f.id);
    const lines = [
      f.desc?.trim(),
      members && `成员：${members}`,
      !lore && `主角在该阵营的声望：${repTier(rep)}（${rep}）。该阵营成员对主角的态度应与此一致。`,
    ].filter(Boolean);
    return {
      id: `wb_faction_${f.id}`,
      title: `阵营 · ${f.name}`,
      keywords: [f.name, ...(f.tags ?? [])].map((k) => k.trim()).filter(Boolean),
      content: lines.join("\n"),
      enabled: true,
      mode: "keyword",
      order: 90,
    };
  });
}
