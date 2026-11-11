import { loadGlobal, saveGlobal } from "../lib/saveScope";
import type { GameState, MapArrival, MapEdits, MapSpotEdit, Player, SimState } from "../lib/types";
import { getWorld } from "../mods/registry";
import { evalFixedCond } from "./fixedEvents";

/* 地图 · 开局起点 / 解锁 / 条件抵达 / 地图库。与题材无关，只读 mapEdits。 */
const spots = (m?: MapEdits) =>
  Object.entries(m ?? {}).filter(([k, v]) => k !== "_config" && v) as [string, MapSpotEdit][];

/** 开局起点：先找绑定了玩家身份/出身的地点，再找默认起点；都没有返回 undefined（用世界观默认） */
export function resolveStart(m: MapEdits | undefined, p: Pick<Player, "identity" | "background">): string | undefined {
  const keys = [p.identity, p.background].filter(Boolean);
  const bound = spots(m).find(([, e]) => e.startFor?.some((k) => keys.includes(k)));
  return bound?.[0] ?? spots(m).find(([, e]) => e.start)?.[0];
}

/** 地点是否已在地图上显示 */
export function spotUnlocked(m: MapEdits | undefined, id: string, s: SimState): boolean {
  const e = m?.[id] as MapSpotEdit | undefined;
  if (!e?.unlock || e.unlock === "open" || e.start || s.room === id || (s.visited ?? []).includes(id)) return true;
  if (e.unlock === "story") return false;
  return (e.unlockConds ?? []).every((c) => evalFixedCond(c, s));
}

export const ageNow = (g: Pick<GameState, "player" | "sim">) =>
  (parseInt(g.player.age, 10) || 18) + Math.floor(((g.sim.week ?? 1) - 1) / 52);

/** 条件抵达：按地点顺序取第一条满足且未触发的 */
export function pickArrival(g: GameState, order: string[]): { room: string; a: MapArrival } | null {
  const fired = g.arrivalsFired ?? [];
  const m = g.mapEdits ?? {};
  for (const id of order) {
    for (const a of (m[id] as MapSpotEdit | undefined)?.arrivals ?? []) {
      if (fired.includes(a.id) || (a.minAge == null && a.minWeek == null)) continue;
      if (a.minAge != null && ageNow(g) < a.minAge) continue;
      if (a.minWeek != null && (g.sim.week ?? 1) < a.minWeek) continue;
      if (g.sim.room === id) continue;
      return { room: id, a };
    }
  }
  return null;
}

/* —— 地图库：存在本机，按世界观区分；「开局使用」的那份在新开局时自动套用 —— */
export type MapPreset = { id: string; name: string; world: string; edits: MapEdits; at: number; useOnStart?: boolean };
const K = "star:map-library";
export const readLibrary = (): MapPreset[] => { const v = loadGlobal<MapPreset[]>(K, []); return Array.isArray(v) ? v : []; };
export const writeLibrary = (l: MapPreset[]) => {
  return saveGlobal(K, l); // 底图过大时可能超出本地存储
};
export const startPreset = (): MapPreset | undefined => readLibrary().find((p) => p.useOnStart && p.world === getWorld().worldId);
