/**
 * 统一的游戏数据类型定义
 * 用于合并 visual 和 worldInteraction 两种模式的数据结构
 */

// 关键事件类型
export interface KeyEvent {
    title: string;
    description: string;
}

// 玩家角色类型（统一版本）
export interface Player {
    name: string;
    age?: number;                    // 可选，因为 worldInteraction 模式是必填
    gender: string;
    race?: string;                   // 仅 visual 模式有
    appearance: string;
    personality?: string;            // 可选，因为 worldInteraction 模式是必填
    tone?: string;                   // 可选，因为 worldInteraction 模式是必填
    // 图片字段：visual 模式用 image，worldInteraction 模式用 imagePath
    image?: string;                  // visual 模式
    imagePath?: string;              // worldInteraction 模式
    images?: {                       // visual 模式可能的多图片
        [variant: string]: string;
    };
}

// NPC 类型（统一版本）
export interface NPC {
    id: string;
    name: string;
    age?: number;                    // 可选，因为 worldInteraction 模式是必填
    gender: string;
    job?: string;                    // 仅 visual 模式有
    race?: string;                   // 仅 visual 模式有
    description: string;
    appearance: string;
    personality?: string;            // 可选，因为 worldInteraction 模式是必填
    tone: string;
    relationship?: string;           // 仅 visual 模式有
    images?: {                       // 可选，因为 worldInteraction 模式是必填
        base: string;
        [key: string]: string;
    };
    abilities?: string[];            // 仅 visual 模式有
    dialogue?: string[];             // 仅 visual 模式有
}

// 子场景类型（统一版本）
export interface SubScene {
    id: string;
    name: string;
    description: string;
    image: string;
    npcs: string[];                  // NPC的id数组
    position: [number, number];
    npcs_slots?: {                   // 可选，因为 worldInteraction 模式是必填
        position: [number, number];
        zoom: number;
    }[];
}

// 场景类型（统一版本）
export interface Scene {
    id: string;
    name: string;
    type?: string;                   // 仅 visual 模式有
    description: string;
    atmosphere?: string;             // 仅 visual 模式有
    dangerLevel?: number;            // 仅 visual 模式有
    image?: string;                  // 可选，因为 worldInteraction 模式是必填
    items?: string[];                // 仅 visual 模式有
    events?: string[];               // 仅 visual 模式有
    soundtrack?: string;             // 可选，因为 worldInteraction 模式是必填
    subscenes: SubScene[];
    position?: [number, number];      // 仅 worldInteraction 模式有
}

// 世界设定类型（统一版本）
export interface WorldSetting {
    title: string;
    summary?: string;                // 可选，因为 worldInteraction 模式是必填
    background: string;
    Theme?: string[];                // 可选，因为 worldInteraction 模式是必填
    preamble: string;
    initialPlot: string;
    literary: string;
    keyEvents?: KeyEvent[];           // 可选，因为 worldInteraction 模式是必填
    WorldRules?: {                   // 仅 visual 模式有
        [key: string]: string;
    };
    player: Player;                  // 统一使用小写 player
    worldMapImage?: string;          // 仅 worldInteraction 模式有
}

// NPC 设定类型
export interface NPCSetting {
    npcs: NPC[];
}

// 场景设定类型
export interface SceneSetting {
    scenes: Scene[];
}

// 元数据类型（仅 visual 模式有）
export interface Metadata {
    [key: string]: any;
}

// 统一的游戏数据类型（主响应类型）
export interface UnifiedGameData {
    success: boolean;
    fileId: string;
    worldSetting: WorldSetting;
    npcSetting: NPCSetting;
    sceneSetting: SceneSetting;
    metadata?: Metadata | null;      // 仅 visual 模式有
}

