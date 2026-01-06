// MapPanel 共享类型定义

export interface SubScene {
    id: string;
    name: string;
    description?: string;
    image?: string;
    npcs?: string[];
    position?: number[];
    npcs_slots?: Array<{ position?: number[]; zoom?: number }>;
    parentId?: string;
    parentName?: string;
}

export interface Scene {
    id: string;
    name: string;
    description?: string;
    image?: string;
    subscenes?: SubScene[];
    position?: [number, number];
}

export interface MapPanelProps {
    sceneSetting?: {
        scenes?: Scene[];
    };
    worldMapImage?: string | null;
    fileId: string;
    onDataChange?: () => void;
    isActive?: boolean;
}

export interface PlacedNPC {
    id: string;
    x: number;
    y: number;
    scale: number;
    zIndex?: number;
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

