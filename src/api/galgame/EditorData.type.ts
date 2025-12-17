import type { 
    UnifiedGameData, 
    WorldSetting as UnifiedWorldSetting,
    Player as UnifiedPlayer,
    NPC as UnifiedNPC,
    Scene as UnifiedScene,
    SceneSetting as UnifiedSceneSetting,
    NPCSetting as UnifiedNPCSetting
} from "../common/gameData.type";

// 为了向后兼容，保留原有类型定义
// 但实际使用 UnifiedGameData
export type AllGameData = UnifiedGameData & {
    success: true;  // 字面量类型
    metadata: Metadata | null;  // 必填
};

// 重新导出统一类型，保持向后兼容
export type WorldSetting = UnifiedWorldSetting;
export type Player = UnifiedPlayer;
export type NPC = UnifiedNPC;
export type Scene = UnifiedScene;
export type SceneSetting = UnifiedSceneSetting;
export type NPCSetting = UnifiedNPCSetting;

// 子场景类型（从统一类型导入）
export type { SubScene } from "../common/gameData.type";

// Metadata 类型
export interface Metadata {
    [key: string]: any;                 // 元数据，结构不固定
}

export interface GenerateNpcImageRequest {
    npc: {
        id: string;
        name: string;
        age: number;
        gender: string;
        job: string;
        race: string;
        description: string;
        appearance: string;
    };
    fileId: string;
    removeBg: boolean;
    mode: string;
}

export interface GenerateSceneImageRequest {
    scene: {
        id: string;
        name: string;
        description: string;
    };
    fileId: string;
    mode: string;
}

export interface GenerateVariantImageRequest {
    npcId: string,              
    baseImagePath: string,       
    variant: {
        type: 'expression' | 'clothing' | 'pose',  
        value: string,             
        description?: string       
    },
    fileId: string,              
    removeBg?: boolean;
}