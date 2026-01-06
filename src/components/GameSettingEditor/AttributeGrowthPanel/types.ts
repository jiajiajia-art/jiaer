export type AttributeTarget = 'player' | 'npc';

export interface AttributeConfig {
    id: string;
    target: AttributeTarget;
    key: string;
    name: string;
    displayName: string;
    description: string;
    defaultValue: number;
    maxValue: number;
    unit: string;
    required: boolean;
    visible: boolean;
    formula?: string;
}

export const MOCK_ATTRIBUTES: AttributeConfig[] = [
    {
        id: 'attr-stamina',
        target: 'player',
        key: 'stamina',
        name: '体力',
        displayName: '体力',
        description: '影响持续战斗和探索表现，低于 20 进入疲惫状态。',
        defaultValue: 80,
        maxValue: 100,
        unit: '点',
        required: true,
        visible: true,
        formula: '基础体力值 - 行动消耗 + 休息恢复',
    },
    {
        id: 'attr-mood',
        target: 'player',
        key: 'mood',
        name: '情绪',
        displayName: '情绪',
        description: '决定好感发展趋势，用 AI 判断情绪快照。',
        defaultValue: 65,
        maxValue: 100,
        unit: '%',
        required: false,
        visible: true,
        formula: '基础情绪 + 事件影响',
    },
    {
        id: 'attr-study',
        target: 'player',
        key: 'study',
        name: '学业',
        displayName: '学业',
        description: '影响结局分支解锁，用于衡量学业成长情况。',
        defaultValue: 45,
        maxValue: 100,
        unit: '%',
        required: false,
        visible: true,
    },
    {
        id: 'attr-favor',
        target: 'npc',
        key: 'favor',
        name: '好感度',
        displayName: '好感度',
        description: '用于衡量玩家与该 NPC 的关系亲密度，影响专属剧情触发。',
        defaultValue: 30,
        maxValue: 100,
        unit: '%',
        required: true,
        visible: true,
    },
    {
        id: 'attr-trust',
        target: 'npc',
        key: 'trust',
        name: '信任度',
        displayName: '信任度',
        description: '用于判断是否可以解锁更深入的剧情分支或委托任务。',
        defaultValue: 20,
        maxValue: 100,
        unit: '%',
        required: false,
        visible: false,
    },
];


