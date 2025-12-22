/**
 * 类型定义
 */
export interface Relationship {
    id: string;
    name: string;
    description: string;
}

export interface Variation {
    id: string;
    label: string;
    img: string;
    type?: string; // 差分类型值，如 'happy', 'sad' 等
    description?: string; // 差分描述（可选）
}

export interface Character {
    id: string;
    name: string;
    callName: string;
    gender: string;
    role: string;
    identity: string;
    personality: string[];
    speech: string;
    appearance: string;
    portrait: string;
    background: string;
    growth: string;
    goalShort: string;
    goalLong: string;
    secret: string;
    relationships: Relationship[];
    variations: Variation[];
}

export const VARIATION_TYPES = [
    { value: 'expression', label: '表情' },
    { value: 'clothing', label: '服装' },
    { value: 'pose', label: '姿势' },
] as const;

export const DEFAULT_NPC_PORTRAIT = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;

