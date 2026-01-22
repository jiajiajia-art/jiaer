/**
 * WorldInteraction 模式的游戏数据类型定义
 * 独立管理 worldInteraction 模式的数据结构
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
    attributes?: {
      [attributeKey: string]: {
        displayName: string;
        value: number;
        formula: string;
        visible: boolean;
      };
  }
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
    attributes?: {
        [attributeKey: string]: {
            displayName: string;
            value: number;
            formula: string;
            visible: boolean;
        };
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
    abilityNodes: string[];
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
    player: PlayerCharacter;
    worldMapImage: string;
}

export interface AbilityNode {
    node_id: string;
    authorNote: string,
    name?: string,
    type: string;
    imagePath: string;
    imagePrompt: string;
    actions: Action[];
    position?: [number, number],
    layer?: number,
    scale?: number,
    color?: string,
    tempImageId?: string; // AI生图返回的临时图片ID（仅用于提交，不会持久化）
}

// 基础属性元数据接口
interface AttributeMeta {
    displayName: string;
    description: string;
    defaultValue: number;
    maxValue: number;
    unit: string;
    visible: boolean;
    formula: string;
  }
  
  // 属性状态接口
  interface AttributeState {
    value: number;
    formula: string;
    displayName: string;
  }
  
  // 玩家属性定义（固定类别player，但内部属性动态）
  interface PlayerAttributeDefinitions {
    [attributeKey: string]: AttributeMeta;
  }
  
  // NPC属性定义（固定类别npc，但内部属性动态）
  interface NPCAttributeDefinitions {
    [attributeKey: string]: AttributeMeta;
  }
  
  // 玩家属性状态（玩家只有一个实体）
  interface PlayerAttributeStates {
    player: {
      [attributeKey: string]: AttributeState;
    };
  }
  
  // NPC属性状态（多个NPC实体，每个NPC有多个属性）
  interface NPCAttributeStates {
    [npcId: string]: {
      [attributeKey: string]: AttributeState;
    };
  }
  
  export interface AttributeSetting {
    attributeDefinitions: {
      player: PlayerAttributeDefinitions;
      npc: NPCAttributeDefinitions;
    };
    attributeStates: {
      player: PlayerAttributeStates;
      npc: NPCAttributeStates;
    };
  }

export interface Action {
    id: string;
    name: string;
    description: string;
}

export interface NPCSetting {
    npcs: NPC[];
}

export interface SceneSetting {
    scenes: Scene[];
}

export interface AbilityNodeSetting {
    abilityNodes: AbilityNode[];
}

export interface WorldInteractionGameData {
    success: boolean;
    fileId: string;
    worldSetting: WorldSetting;
    npcSetting: NPCSetting;
    sceneSetting: SceneSetting;
    abilityNodeSetting?: AbilityNodeSetting;
    attributeSetting?: AttributeSetting;
    coverUrl: string;
}

export interface UploadWorldFileResponse {
    success: boolean;
    jobId: string;
    fileId: string;
    status: string;
    message: string;
}

export interface AddAttributesRequest {
  type: string;
  attributes: {
    key: string;
    displayName: string;
    description: string;
    defaultValue: number;
    maxValue: number;
    unit: string;
    visible: boolean;
    formula: string;
  };
}

export interface updateAttributesResponse {
  success: boolean;
  message: string;
  result: {
    type: string;
    key: string;
    definition: AttributeMeta;
  };
}

export interface AddAttributesResponse {
  success: boolean;
  message: string;
  result:{
    npcId: string;
    attributeName: string;
    state: {
      value: number;
      formula: string;
    };
  }[];
}

export interface DeleteAttributesRequest {
  fileId: string;
  type: string;
  attributeName: string;
}

export interface NpcAddAttributesRequest {
    fileId: string;
    id: string;
    attributeNames: string[];
}

export interface NpcDeleteAttributesRequest {
    fileId: string;
    id: string;
    attributeName: string;
}

export interface NpcUpdateAttributesRequest {
    id: string;
    update: {
        [attributeKey: string]: {
            value: number;
            formula: string;
        };
    };
}

export interface GetAttributesResponse {
  success: boolean;
  player: PlayerCharacter;
  npcs: NPC[];
  sessionId: string;
}