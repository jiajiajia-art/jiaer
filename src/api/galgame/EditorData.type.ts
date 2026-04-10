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
  background?: string;
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

export interface StoryStructure {
  enabled: boolean;
  defaultPhase: string;
  phases: {
    id: string;
    name: string;
    description: string;
    context: string;
    activeByDefault: boolean;
    setFlags: string[];
    transitions: {
      targetPhase: string;
      condition: {
        minTurns: number;
        flags: {
          required: string[];
          anyOf: string[];
        };
      };
      automatic: boolean;
    }[];
    isFinalPhase: boolean;
  }[];
}

export interface DynamicEntry {
id: string;
category: string;
content: string;
activationConditions: {
  flags: {
    required: string[];
  };
  probability: number;
  maxActivations: number;
};
setFlags: string[];
sticky: number;
cooldown: number;
order: number;
enabled: boolean;
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
  player: Player;
  dynamicEntries?: DynamicEntry[];
  llmConfig?: {
      targetOutputLength?: number;
      outputLengthMode?: "characters" | "words";
      minOutputLength?: number;
      maxOutputLength?: number;
  },
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
  storySetting: StoryStructure;
  coverUrl: string;
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

export interface GenerateCategoryProgress {
  total: number;
  effective: number;
}

export interface GenerateAllImagesSummary {
  totalRequested: number;
  totalEffective: number;
  totalErrors: number;
}

export interface GenerateAllImagesPoints {
  deducted: number;
  remaining: number;
}

export interface GenerateAllImagesResponse {
  success: boolean;
  message: string;
  npcs?: GenerateCategoryProgress;
  scenes?: GenerateCategoryProgress;
  player?: GenerateCategoryProgress;
  variants?: GenerateCategoryProgress;
  summary?: GenerateAllImagesSummary;
  points?: GenerateAllImagesPoints;
  details?: unknown;
  errors?: unknown;
}

export interface BatchImageJobPayload {
  success: boolean;
  message: string;
  results: {
    npcsGenerated?: number;
    npcsTotal?: number;
    scenesGenerated?: number;
    scenesTotal?: number;
    effectiveSuccessful?: number;
    totalSuccessful?: number;
    totalGenerated?: number;
    totalImages?: number;
    pointsDeducted?: number;
    remainingPoints?: number | null;
    [key: string]: unknown;
  };
  details?: unknown;
  errors?: unknown;
}

export interface StartBatchImageJobResponse {
  success: boolean;
  jobId: string;
  fileId: string;
  status: 'running' | 'queued' | 'pending' | 'completed';
  totalCount: number;
  message?: string;
  error?: string;
}

export interface BatchImageJobStatus {
  success: boolean;
  jobId: string;
  fileId?: string;
  status: 'running' | 'queued' | 'pending' | 'completed' | 'failed' | 'unknown';
  totalCount: number;
  completedCount: number;
  failedCount: number;
  progress?: number;
  startedAt?: string;
  updatedAt?: string;
  elapsedSeconds?: number | null;
  estimatedRemainingSeconds?: number | null;
  estimatedTotalSeconds?: number | null;
  result?: BatchImageJobPayload | null;
  error?: string | null;
  message?: string;
}

export interface BatchImageJobResult {
  success: boolean;
  jobId: string;
  fileId: string;
  result: BatchImageJobPayload;
  error?: string;
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
  elapsedSeconds?: number;
  estimatedRemainingSeconds?: number;
  estimatedTotalSeconds?: number;
  estimateSource?: string;
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

export interface GenerateStoryStructureResponse {
  success: boolean;
  data:{
    storyPhases: StoryStructure;
    dynamicEntries: DynamicEntry[];
    message: string;
  }
}

export interface CheckGenerateStatusResponse {
  success: boolean;
  jobId: string;
  fileId?: string;
  status: 'running' | 'queued' | 'pending' | 'completed' | 'failed' | 'unknown';
  progress?: number;
  stage?: string;
  error?: string;
  updatedAt?: string;
}

export interface GetGenerateResultResponse {
  success: boolean;
  jobId?: string;
  fileId?: string;
  status?: 'completed';
  stage?: string;
  progress?: number;
  updatedAt?: string;
  result?: {
    storyPhases: StoryStructure;
    dynamicEntries: DynamicEntry[];
    message: string;
  };
}
