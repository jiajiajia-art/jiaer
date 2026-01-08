// MapPanel 共享类型定义

export interface SubScene {
    id: string;
    name: string;
    description?: string;
    image?: string;
    npcs?: string[];
    position?: number[];
    npcs_slots?: Array<{ position?: number[]; zoom?: number; layer?: number }>;
    parentId?: string;
    parentName?: string;
    abilityNodes?: string[]; // 功能性NPC的ID数组
}

export interface Scene {
    id: string;
    name: string;
    description?: string;
    image?: string;
    subscenes?: SubScene[];
    position?: [number, number];
    abilityNodes?: string[];
}

import type { AbilityNodeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';

export interface MapPanelProps {
    sceneSetting?: {
        scenes?: Scene[];
    };
    worldMapImage?: string | null;
    fileId: string;
    onDataChange?: () => void;
    isActive?: boolean;
    abilityNodeSetting?: AbilityNodeSetting;
}

export interface PlacedNPC {
    id: string;
    x: number;
    y: number;
    scale: number;
    zIndex?: number;
    nodeId: string;
    imagePath?: string;
    type: string;
    name?: string;
    authorNote: string;
    backgroundColor?: string;
}

export interface PlacedSubScene {
    id: string;
    name: string;
    x: number;
    y: number;
    parentSceneId: string;
}

export interface PlacedScene {
    id: string;
    name: string;
    x: number;
    y: number;
    image?: string;
}

export interface ImageDisplayBounds {
    displayWidth: number;
    displayHeight: number;
    offsetX: number;
    offsetY: number;
}

export interface NPCPosition {
    left: number;
    top: number;
    width: number;
    height: number;
    visible: boolean;
}

