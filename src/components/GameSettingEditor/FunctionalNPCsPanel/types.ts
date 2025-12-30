// 功能性NPC类型定义

export type FunctionalNPCType = 'portrait' | 'button'; // 立绘型 / 按钮型

export interface FunctionalNPCOption {
    id: string;
    name: string; // 选项名（游戏端展示）
    description: string; // 具体描述（给大模型用的提示词）
}

export interface FunctionalNPC {
    id: string;
    name: string;
    type: FunctionalNPCType;
    image: string; // 立绘图URL
    buttonText?: string; // 按钮文字（仅按钮型）
    hasOptions: boolean; // 点击后是否显示选项
    description?: string; // 功能描述（当hasOptions为true时使用）
    options: FunctionalNPCOption[]; // 选项列表（当hasOptions为false时使用）
}

export interface FunctionalNPCListResponse {
    success: boolean;
    functionalNPCs: FunctionalNPC[];
}

export interface FunctionalNPCResponse {
    success: boolean;
    functionalNPC: FunctionalNPC;
}

