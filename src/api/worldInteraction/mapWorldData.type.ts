/**
 * 游戏地图数据类型定义（worldInteraction 模式）
 * 独立管理游戏运行时的数据结构，不使用联合类型
 */

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
    images: string;
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
    npcs_slots?: {
        position: [number, number];
        zoom: number;
        layer?: number;
    }[];
    abilityNodes?: string[]; 
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
    premise?: string;
    Theme: string[];
    preamble: string;
    initialPlot: string;
    literary: string;
    keyEvents: KeyEvent[];
    player: PlayerCharacter;  // 游戏运行时使用大写 P
    worldMapImage: string;
}

export interface NPCSetting {
    npcs: NPC[];
}

export interface SceneSetting {
    scenes: Scene[];
}

import type { AbilityNodeSetting } from './worldInteractionApi.type';

// 游戏地图的完整数据类型
export interface AllGameData {
    success: boolean;
    fileId: string;
    worldSetting: WorldSetting;
    npcSetting: NPCSetting;
    sceneSetting: SceneSetting;
    abilityNodeSetting?: AbilityNodeSetting; // 功能性NPC设置
}
