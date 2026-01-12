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


