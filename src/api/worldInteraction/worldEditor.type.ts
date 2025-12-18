/**
 * 编辑器 API 类型定义
 * 编辑器使用 UnifiedGameData 联合类型，可以处理两种模式
 */

export interface NpcSlot {
  position: [number, number];
  zoom: number;
}

export interface generateWorldMapImageResponse {
  imagePath: string;
  message: string;
  success: boolean;
}

// 编辑器 API 返回的数据使用 UnifiedGameData（联合类型）


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