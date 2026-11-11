// 功能性NPC类型定义

export type FunctionalNPCType = 'portrait' | 'button'; // 立绘型 / 按钮型

export interface FunctionalNPCOption {
    id: string;
    name: string;
    description: string;
}

export interface FunctionalNPC {
    id: string;
    authorNote: string,
    name?: string,
    type: FunctionalNPCType;
    image: string;
    buttonText?: string;
    hasOptions: boolean;
    description?: string;
    options: FunctionalNPCOption[];
}

export interface FunctionalNPCListResponse {
    success: boolean;
    functionalNPCs: FunctionalNPC[];
}

export interface FunctionalNPCResponse {
    success: boolean;
    functionalNPC: FunctionalNPC;
}

