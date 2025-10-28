export interface PlayerData {
    profile: {
        avatar: string;
        name: string;
        age: number;
        gender: string;
        job: string;
        description: string;
    };
    stats: {
        level: number;
        health: number;
        maxHealth: number;
        attack: number;
        defense: number;
        speed: number;
    };
    currency: {
        gold: number;
    };
    inventory: {
        equipment: Equipment;
        items: Item[];
    };
}

export interface Equipment {
    head: Item | null;
    body: Item | null;
    hands: Item | null;
    feet: Item | null;
    back: Item | null;
    leftHand: Item | null;
    rightHand: Item | null;
}

export interface Item {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
    usable: boolean;
    stackable: boolean;
    effects: {
        health?: number;
    };
    quantity: number;
}

export interface Scene {
    id: string;
    name: string;
    description: string;
    image: string;
    buildings: Building[];
    npcs: NPC[];
    exits: Exit[];
}

export interface Building {
    id: string;
    name: string;
    description: string;
    image: string;
}

export interface NPC {
    id: string;
    name: string;
    job: string;
    gender: string;
    age: number;
    avatar: string;
    description: string;
    relationships: number;
}

export interface Relationship {
    npcId: string;
    name: string;
    type: string;
    avatar: string;
}

export interface Exit {
    id: string;
    name: string;
    description: string;
    direction: string;
    targetSceneId: string;
    travelCost: number;
}

export interface GameEvent {
    id: string;
    title: string;
    description: string;
    image: string;
    options: EventOption[];
}

export interface EventOption {
    text: string;
    action: () => void;
}

export interface GameTime {
    currentYear: number;
    yearName: string;
    currentMonth: number;
    currentDay: number;
    monthNames: string[];
    season: string;
    timeOfDay: string; // 例如: '清晨', '上午', '中午', '下午', '傍晚', '夜晚'
}