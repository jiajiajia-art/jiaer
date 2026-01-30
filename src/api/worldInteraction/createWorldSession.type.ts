import type { AbilityNode, PlayerCharacter } from "./worldInteractionApi.type";

export interface CreateWorldSessionResponse {
  success: true;
  message: string;
  data: {
    session: {
      id: number;
      session_id: string;
      user_id: string;
      file_id: string;
      status: string;
      files: string;
      started_at: string;
      ended_at: string;
      is_deleted: number;
    };
    initFilesPath: string | null;
    sessionDataSync: {
      success: boolean;
      bucket: string;
      prefix: string;
      destRoot: string;
    };
  };
}
// export interface CreateWorldSessionResponse {
//     success: true,
//     message: string,
//     session: {
//         sessionId: string,
//         fileId: string,
//         currentRound: number,
//         worldInfo: {
//             title: string,
//             summary: string,
//             themes: string[]
//         },
//         player: {
//             name: string,
//             age: number,
//             gender: string,
//             personality: string,
//             appearance: string,
//             tone: string,
//             imagePath: string
//         }
//     }
// }

interface KeyEvent {
  title: string;
  description: string;
}

// 玩家角色类型
interface Player {
  name: string;
  age: number;
  gender: string;
  personality: string;
  appearance: string;
  tone: string;
  imagePath: string;
}

// NPC图像类型
interface NPCImages {
  base: string;
  [key: string]: string; // 动态的表情图片
}

// NPC类型
interface NPC {
  id: string;
  name: string;
  age: number;
  gender: string;
  description: string;
  appearance: string;
  personality: string;
  tone: string;
  images: NPCImages;
}

// NPC插槽位置类型
interface NPCsSlot {
  position: [number, number];
  zoom: number;
}

// 子场景类型（包含父场景信息）
interface SubsceneWithParent {
  id: string;
  name: string;
  description: string;
  image: string;
  npcs: string[];
  position: [number, number];
  npcs_slots?: NPCsSlot[];
  parentSceneId: string;
  parentSceneName: string;
}

// 子场景类型（不包含父场景信息）
interface Subscene {
  id: string;
  name: string;
  description: string;
  image: string;
  npcs: string[];
  position: [number, number];
  npcs_slots?: NPCsSlot[];
  abilityNodes: string[];
}

// 场景类型
interface Scene {
  id: string;
  name: string;
  description: string;
  image: string;
  subscenes: Subscene[];
  soundtrack: string;
  position: [number, number];
}

export interface WorldInfo {
  title: string;
  summary: string;
  background: string;
  Theme: string[];
  preamble: string;
  initialPlot: string;
  literary: string;
  keyEvents: KeyEvent[];
  player: PlayerCharacter; // 注意：大写 P
  worldMapImage: string;
}

// 状态类型
interface GameState {
  sessionId: string;
  fileId: string;
  currentRound: number;
  worldInfo: WorldInfo;
  abilityNodes: AbilityNode[];
  player: Player;
  currentKeyEvent: KeyEvent;
  currentKeyEventIndex: number;
  completedKeyEvents: string[];
  totalKeyEvents: number;
  allKeyEventsCompleted: boolean;
  activeEvents: any[]; // 根据实际情况可以进一步定义
  scenes: Scene[];
  allSubscenes: SubsceneWithParent[];
  npcs: NPC[];
  visitedScenes: string[];
  visitedSubscenes: string[];
  totalEvents: number;
  eventHistory: any[]; // 根据实际情况可以进一步定义
}


export interface GetWorldFilesBySessionResponse {
  success: boolean;
  state: GameState;
}

export interface CreateWorldEditSessionRequest {
  success: boolean;
  message: string;
  session: {
    sessionId: string;
    fileId: string;
    presetId: string | null;
    currentRound: number;
    worldInfo: {
      title: string;
      summary: string;
      themes: string[];
      image: string;
    };
    player: Player;
  };
}

export interface GetAVGFilesResponse {
  success: boolean;
  fileId: string;
  worldSetting: WorldInfo;
  npcSetting:{ 
    npcs: NPC[];
  };
  sceneSetting: {
    scenes: Scene[];
  };
  abilityNodeSetting: {
    abilityNodes: AbilityNode[];
  };
}