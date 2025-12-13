export interface KeyEvent {
    title: string;
    description: string;
}

export interface PlayerCharacter {
    name: string;
    age: number;
    gender: string;
    personality: string;
    appearance: string;
    tone: string;
    imagePath: string;
}

export interface NPC {
    id: string;
    name: string;
    age: number;
    gender: string;
    description: string;
    appearance: string;
    personality: string;
    tone: string;
    images: {
        base: string;
        [key: string]: string;
    };
}

export interface SubScene {
    id: string;
    name: string;
    description: string;
    image: string;
    npcs: string[];
    position: [number, number];
    npcs_slots: {
        position: [number, number];
        zoom: number;
    }[];
}

export interface Scene {
    id: string;
    name: string;
    description: string;
    image: string;
    subscenes: SubScene[];
    soundtrack: string;
    position: [number, number];
}

export interface WorldSetting {
    title: string;
    summary: string;
    background: string;
    Theme: string[];
    preamble: string;
    initialPlot: string;
    literary: string;
    keyEvents: KeyEvent[];
    Player: PlayerCharacter;
}

export interface NPCSetting {
    npcs: NPC[];
}

export interface SceneSetting {
    scenes: Scene[];
}

export interface AllGameData {
    success: boolean;
    fileId: string;
    worldSetting: WorldSetting;
    npcSetting: NPCSetting;
    sceneSetting: SceneSetting;
}
