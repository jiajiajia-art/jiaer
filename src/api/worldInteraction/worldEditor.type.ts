import type { UnifiedGameData } from "../common/gameData.type";

export interface NpcSlot {
  position: [number, number];
  zoom: number;
}

export interface generateWorldMapImageResponse {
  imagePath: string;
  message: string;
  success: boolean;
}

// 为了向后兼容，保留原有类型定义
// 但实际使用 UnifiedGameData
export type GameWorldResponse = UnifiedGameData;
