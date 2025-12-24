/**
 * 编辑器 API 类型定义
 * 编辑器使用 UnifiedGameData 联合类型，可以处理两种模式
 */

export interface NpcSlot {
  position: [number, number];
  zoom: number;
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

export interface CalculatePointsResponse {
    success: boolean;
    message: string;
    points: number;
}

export interface UploadSceneImageResponse {
    success: boolean;
    message: string;
    imagePath: string;
    sceneId: string;
}

export interface UploadNpcImageResponse {
    success: boolean;
    message: string;
    imagePath: string;
    variant: string;
    npcId: string;
}

export interface UploadPlayerImageResponse {
    success: boolean;
    message: string;
    imagePath: string;
    variant: string;
}

export interface UploadSubSceneImageResponse {
    success: boolean;
    message: string;
    imagePath: string;
    sceneId: string;
    subsceneId: string;
}