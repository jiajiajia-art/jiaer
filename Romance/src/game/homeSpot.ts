/* 常驻地点（Npc.home）：只能从当前世界的地图地点里选（含玩家自建地点），显示名与地图编辑 / 剧情一致 */
import type { GameState } from "../lib/types";
import { spotName } from "./mapedits";
import { spotUnlocked } from "./mapStart";
import { PERSON_BY_ID, allRooms, locOf } from "./mud";

type MapView = Pick<GameState, "mapEdits">;

/** 地点显示名：地图编辑里的改名优先，其次地点原名 */
export const placeName = (g: MapView, id: string): string => spotName(g, id) || locOf(id)?.name || id;

/** 可选的常驻地点：当前地图上已出现（已解锁）的地点；当前选中值即使未解锁也保留 */
export function homeOptions(g: Pick<GameState, "mapEdits" | "sim">, value?: string): string[] {
  return allRooms().filter((id) => id === value || spotUnlocked(g.mapEdits, id, g.sim));
}

/** 人物资料卡上的常驻地点：编辑器里选定的优先，其次内容池的常驻地点覆盖 / 据点；未知返回 undefined */
export function homePlaceOf(g: MapView, n?: { home?: string }, p?: { home?: string; whereabouts?: string }): string | undefined {
  const rooms = allRooms();
  if (n?.home && rooms.includes(n.home)) return placeName(g, n.home);
  return p?.whereabouts?.trim() || (p?.home && rooms.includes(p.home) ? placeName(g, p.home) : undefined);
}

/** 编辑器里的行为说明：设了常驻地点 / 沿用内容池原设定 / 不上地图 */
export function homeHint(g: MapView, pid: string, home: string): string {
  const p = pid ? PERSON_BY_ID[pid] : undefined;
  if (home) return `平时多半待在「${placeName(g, home)}」，也会出门走动；去那儿最容易碰上 TA。`;
  if (p?.home) return p.kind === "roam" ? `未设定：沿用原设定，在「${placeName(g, p.home)}」一带走动。` : `未设定：沿用原设定，守在「${placeName(g, p.home)}」。`;
  return "未设定：TA 不会出现在地图上，可以在人脉里找 TA。";
}
