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

/**
 * 暂存图片类型 - 用于图片选择/生成后、确认修改前的预览
 */
export interface PendingImage {
    file?: File;                    // 待上传的文件（上传图片时）
    previewUrl: string;            // 本地预览 URL（生成时为服务器返回的URL，上传时为本地Object URL）
    sourceType: 'upload' | 'generate'; // 来源类型：上传或AI生成
    variant: string;                // 图片类型：'base' 或差分label
}

export const VARIATION_TYPES = [
    { value: 'expression', label: '表情' },
    { value: 'clothing', label: '服装' },
    { value: 'pose', label: '姿势' },
] as const;

export const DEFAULT_NPC_PORTRAIT = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;

