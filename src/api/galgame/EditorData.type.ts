/**
 * Visual 模式的游戏数据类型定义
 * 独立管理 visual 模式的数据结构
 */

// 关键事件类型
export interface KeyEvent {
  title: string;
  description: string;
}

// 玩家角色类型（visual 模式）
export interface Player {
  name: string;
  age?: number;
  gender: string;
  race?: string;
  appearance: string;
  personality?: string;
  tone?: string;
  image?: string;
  images?: {
    [variant: string]: string;
  };
}

// NPC 类型（visual 模式）
export interface NPC {
  id: string;
  name: string;
  age?: number;
  gender: string;
  job?: string;
  race?: string;
  description: string;
  appearance: string;
  personality?: string;
  tone?: string;
  relationship?: string;
  images?: {
    [key: string]: string;
  };
  abilities?: string[];
  dialogue?: string[];
}

// 子场景类型（visual 模式）
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

// 场景类型（visual 模式）
export interface Scene {
  id: string;
  name: string;
  type?: string;
  description: string;
  atmosphere?: string;
  dangerLevel?: number;
  image?: string;
  items?: string[];
  events?: string[];
  soundtrack?: string;
  subscenes?: SubScene[];
}

// 世界设定类型（visual 模式）
export interface WorldSetting {
  title: string;
  summary: string;
  background: string;
  Theme?: string[];
  preamble: string;
  initialPlot: string;
  literary: string;
  keyEvents?: KeyEvent[];
  WorldRules?: {
    [key: string]: string;
  };
  player: Player; // visual 模式使用小写 player
}

// NPC 设定类型
export interface NPCSetting {
  npcs: NPC[];
}

// 场景设定类型
export interface SceneSetting {
  scenes: Scene[];
}

// Metadata 类型
export interface Metadata {
  [key: string]: any;
}

// Visual 模式的完整游戏数据类型
export interface AllGameData {
  success: boolean;
  fileId: string;
  worldSetting: WorldSetting;
  npcSetting: NPCSetting;
  sceneSetting: SceneSetting;
  metadata: Metadata | null;
}

export interface GeneratePlayerImageRequest {
  player: Player;
  fileId: string;
  removeBg: boolean;
  pluginType: string;
}

export interface GenerateImageRequest {
  removeBg: boolean;
  pluginType: string;
}

export interface GenerateVariantImageRequest {
  variant: {
    type: "expression" | "clothing" | "pose";
    value: string;
    description?: string;
  };
  removeBg?: boolean;
  pluginType: string;
}

export interface GenerateAllImageRequest {
  generateNPCs: boolean;
  generateScenes: boolean;
  generateVariants: boolean;
  generatePlayer: boolean;
  removeBg: boolean;
  pluginType: string;
}

export interface GenerateImgeResponse {
  success: boolean;
  message: string;
  imagePath: string;
}

export interface UploadFileResponse {
  fileId: string;
  jobId: string;
  status: string;
  success: boolean;
}

export interface CheckUploadStatusResponse {
  success: boolean;
  jobId: string;
  fileId: string;
  stage: string;
  progress: number;
  status: string;
  error: string;
  updatedAt: string;
}

export interface UploadGameCoverResponse {
  success: boolean;
  message: string;
  data: {
    coverUrl: string;
    filename: string;
    fileId: string;
  };
}