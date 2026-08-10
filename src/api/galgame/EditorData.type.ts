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
  portraitScale?: number;
  portraitOffsetX?: number;
  portraitOffsetY?: number;
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
  portraitScale?: number;
  portraitOffsetX?: number;
  portraitOffsetY?: number;
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

/** Visual 侧栏补充提示词（morePromptForms），写入 world.json；v2 title 作 keywords */
export interface MorePromptForm {
  id: string;
  /** 触发型：逗号分隔关键词；常驻型：可选侧栏展示名 */
  title: string;
  description: string;
  content: string;
  /** true = 每轮注入 content，不扫描 title */
  constant?: boolean;
  order: number;
  enabled?: boolean;
  updatedAt?: string;
}

/** Visual Step6 数据库（dataPromptForms），字段结构与 MorePromptForm 一致 */
export type DataPromptForm = MorePromptForm;

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
  /** Visual 编辑器侧栏动态提示词，叙事 LLM 每轮注入 */
  morePromptForms?: MorePromptForm[];
  /** Visual Step6 数据库条目，叙事 LLM 选择性注入 */
  dataPromptForms?: DataPromptForm[];
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
  /** 有值时只生成这些 NPC（配合 generatePlayer） */
  npcIds?: string[];
  /** 有值时只生成这些场景（场景批量 / 重试未完成） */
  sceneIds?: string[];
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
  /** @deprecated 仅兼容；请用 stageStats / items 分栏排查 */
  pipelineProgress?: number | null;
  generateDoneCount?: number | null;
  rembgDoneCount?: number | null;
  generateActiveCount?: number | null;
  rembgActiveCount?: number | null;
  stageStats?: {
    generateActive?: number;
    generateDone?: number;
    rembgActive?: number;
    rembgDone?: number;
    failed?: number;
    settled?: number;
    pending?: number;
    total?: number;
  } | null;
  /** 已抠图并落盘的分项（任务未结束也可增量刷新角色立绘） */
  savedResults?: Array<{
    id: string;
    name?: string;
    index?: number;
    type?: string;
    imagePath: string;
    savedAt?: string;
  }>;
  /** 每张图当前阶段（排查卡点） */
  items?: Array<{
    index: number;
    id?: string;
    name?: string;
    stage: string;
    imagePath?: string;
    updatedAt?: string;
    stageUpdatedAt?: string;
    stageElapsedSeconds?: number;
    error?: string | null;
  }>;
  /** 批量生图阶段日志（生图/抠图流水线） */
  logs?: Array<string | { message: string; at?: string; stage?: string; index?: number; name?: string }>;
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
