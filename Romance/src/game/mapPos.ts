import { getWorldMap, getWorldRooms } from "../mods/registry";
import type { MapEdits } from "../lib/types";

/* 自动点位：没有手绘坐标的地点，逐个挑选离已有点位（手绘 + 已排好的）最远的空位，避免标签互相遮挡 */
const autoCache = new Map<string, Record<string, { x: number; y: number }>>();
export function autoPos(id: string, mode: "panorama" | "single"): { x: number; y: number } {
  const hand = getWorldMap().hotspots?.[mode] ?? {};
  const ids = Object.keys(getWorldRooms()).filter((r) => !(r in hand));
  const key = `${mode}|${Object.keys(hand).join(",")}|${ids.join(",")}`;
  let placed = autoCache.get(key);
  if (!placed) {
    placed = {};
    const taken = Object.values(hand).map((p) => ({ x: p.x, y: p.y }));
    // 候选网格：横向更密（标签横长），纵向留出图钉 + 标签的高度
    const cols = mode === "panorama" ? 12 : 7, rows = 7;
    const cand: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cand.push({ x: 8 + (c / (cols - 1)) * 84, y: 20 + (r / (rows - 1)) * 64 });
    // 标签横向宽，横向距离按更小的权重计入，保证上下错开
    const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * (mode === "panorama" ? 0.6 : 0.45), (a.y - b.y) * 1.4);
    for (const rid of ids) {
      let best = cand[0], bestD = -1;
      for (const p of cand) {
        const d = taken.length ? Math.min(...taken.map((t) => gap(p, t))) : 100 - Math.abs(p.x - 50);
        if (d > bestD) { bestD = d; best = p; }
      }
      placed[rid] = best;
      taken.push(best);
    }
    autoCache.set(key, placed);
  }
  return placed[id] ?? { x: 50, y: 50 };
}

/** 地点在地图上的实际位置：编辑坐标 → 手绘坐标 → 自动排布（与游玩时一致） */
export function spotPos(edits: MapEdits | undefined, id: string, mode: "panorama" | "single") {
  const e = edits?.[id];
  const d = getWorldMap().hotspots?.[mode]?.[id] ?? autoPos(id, mode);
  return { x: e?.x ?? d.x, y: e?.y ?? d.y };
}
