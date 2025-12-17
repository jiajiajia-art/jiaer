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


export interface GenerateNpcImage {
    success: boolean;
    message: string;
    results: {
        npcsGenerated: number;
        npcsTotal: number;
        errors: number;
    };
    details: {
        npcs: {
            npcId: string;
            npcName: string;
            imagePath: string;
            success: boolean;
        }[];
    };
    errors: string[];
}

export interface GenerateALLSceneImage {
    success: boolean;
    message: string;
    results: {
        scenesGenerated: number;
        scenesTotal: number;
        errors: number;
    };
}