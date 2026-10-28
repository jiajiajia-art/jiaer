import type { GlobalMapConfig, MapEdits, MapSheet } from "../lib/types";

/* 多底图：未配置时只有一张「主地图」（沿用 _config.bgUrl） */
export const MAIN_SHEET = "main";

export function mapSheets(cfg?: GlobalMapConfig): MapSheet[] {
  const list = cfg?.sheets?.length ? cfg.sheets : [{ id: MAIN_SHEET, name: "主地图" }];
  return list.map((s) => (s.id === MAIN_SHEET ? { ...s, bgUrl: s.bgUrl || cfg?.bgUrl } : s));
}

/** 地点所属底图：未指定或底图已删除 → 主地图（主地图被删则第一张） */
export function sheetOf(edits: MapEdits | undefined, roomId: string, sheets: MapSheet[]): string {
  const want = edits?.[roomId]?.sheet as string | undefined;
  if (want && sheets.some((s) => s.id === want)) return want;
  return (sheets.find((s) => s.id === MAIN_SHEET) ?? sheets[0]).id;
}

/** 有效的点击跳转目标（指向存在且不是自己所在的底图） */
export function jumpOf(edits: MapEdits | undefined, roomId: string, sheets: MapSheet[]): string | undefined {
  const j = edits?.[roomId]?.jumpTo as string | undefined;
  return j && sheets.some((s) => s.id === j) && j !== sheetOf(edits, roomId, sheets) ? j : undefined;
}
