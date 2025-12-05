export interface AllGameData {
    success: true,
    fileId: string,
    worldSetting: WorldSetting,
    npcSetting: NPCSetting,
    sceneSetting: SceneSetting,
    metadata: Metadata | null
}


// WorldSetting 类型
export interface WorldSetting {
    title: string;                    // 游戏标题
    summary?: string;                  // 简短摘要
    background: string;                // 世界背景故事（详细）
    preamble: string;                  // 游戏前言/开场白
    initialPlot: string;                // 初始剧情描述
    literary: string;                  // 文学风格
    Theme?: string[];                  // 主题数组，如：["历史", "成长", "科举"]
    keyEvents?: Array<{                // 关键事件
        title: string;
        description: string;
    }>;
    WorldRules?: {                     // 世界规则，键值对形式
        [key: string]: string;
    };
    player: Player;
}

export interface Player {
    name: string;                    // 玩家角色名称
    age?: number;                    // 年龄
    gender: string;                  // 性别
    race?: string;                   // 种族
    appearance: string;              // 外貌描述
    personality?: string;            // 性格
    tone?: string;                   // 语气
}

// NPCSetting 类型
export interface NPCSetting {
    npcs: NPC[];
}

export interface NPC {
    id: string;                        // NPC唯一标识符（小写英文，下划线连接）
    name: string;                      // NPC名称
    age?: number;                      // 年龄
    gender: string;                    // 性别
    job?: string;                      // 职业
    race?: string;                     // 种族
    description: string;                // 详细描述
    appearance: string;                // 外貌描述
    personality?: string;              // 性格
    tone: string;                      // 说话语气/风格
    relationship?: string;             // 与玩家的关系
    images?: {                         // NPC图片（可选）
        [variant: string]: string;       // 变体名称 -> 图片URL
    };
    abilities?: string[];               // 能力列表（可选）
    dialogue?: string[];               // 对话示例（可选）
}

// SceneSetting 类型
export interface SceneSetting {
    scenes: Scene[];
}

interface Scene {
    id: string;                         // 场景唯一标识符（小写英文，下划线连接）
    name: string;                       // 场景名称
    type?: string;                     // 场景类型
    description: string;                // 详细描述
    atmosphere?: string;                // 氛围描述
    dangerLevel?: number;              // 危险等级（1-10）
    images?: string;                   // 场景图片URL
    items?: string[];                  // 可用物品数组
    events?: string[];                 // 可能发生的事件数组
    soundtrack?: string;               // 背景音乐文件名
}

interface Metadata {
    [key: string]: any;                 // 元数据，结构不固定
}