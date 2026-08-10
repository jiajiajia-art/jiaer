export interface GetGalgamePresetResponse {
  world: WorldSetting;
  npcs: NpcSetting;
  scenes: SceneSetting;
  [key: string]: unknown;
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
  WorldRules?: WorldRules;
  player: PlayerCharacter;
  [key: string]: unknown;
}

export interface KeyEvent {
  title: string;
  description: string;
}

export interface WorldRules {
  magic?: string;
  races?: string;
  language?: string;
  geography?: string;
  danger?: string;
  [key: string]: string | undefined;
}

export interface PlayerCharacter {
  name: string;
  age: number;
  gender: string;
  race?: string;
  background?: string;
  personality?: string;
  appearance?: string;
  tone?: string;
  images: string;
  portraitScale?: number;
  portraitOffsetX?: number;
  portraitOffsetY?: number;
  [key: string]: string | number | undefined;
}

export interface NpcSetting {
  npcs: NPC[];
  [key: string]: unknown;
}

export interface NPC {
  id: string;
  name: string;
  age: number;
  gender: string;
  job?: string;
  race?: string;
  description?: string;
  appearance?: string;
  personality?: string;
  tone?: string;
  relationship?: string;
  abilities?: string[];
  dialogue?: string[];
  images?: NPCImages;
  portraitScale?: number;
  [key: string]: unknown;
}

export interface NPCImages {
  base?: string;
  happy?: string;
  angry?: string;
  serious?: string;
  battle?: string;
  alert?: string;
  aiming?: string;
  determined?: string;
  worried?: string;
  obsessed?: string;
  pitiful?: string;
  evil?: string;
  [key: string]: string | undefined;
}

export interface SceneSetting {
  scenes: Scene[];
  [key: string]: unknown;
}

export interface Scene {
  id: string;
  name: string;
  type: string;
  description: string;
  atmosphere?: string;
  dangerLevel?: number;
  image?: string;
  npcs: string[];
  enemies?: string[];
  items?: string[];
  events: string[];
  exits?: SceneExits;
  soundtrack?: string;
  [key: string]: unknown;
}

export interface SceneExits {
  [direction: string]: string;
}

export type NPCById = Record<string, NPC>;

export interface SceneWithFullNPCs extends Omit<Scene, "npcs"> {
  fullNPCs: NPC[];
}

export interface GetGalgameHistoryResponse {
  success: boolean;
  history: History[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMoreBefore?: boolean;
  hasMoreAfter?: boolean;
  // 后端返回的已访问场景 ID 列表，最后一个元素为当前所在场景
  visitedScenes?: string[];
  contextMemory?: ContextMemoryStatus;
  contextMemoryDebug?: ContextMemoryDebug;
  [key: string]: unknown;
}

export interface ContextMemoryStatus {
  enabled: boolean;
  estimatedTokens: number;
  thresholdTokens: number;
  modelContextWindow: number;
  modelContextWindowConfigured?: boolean;
  debugEnabled?: boolean;
  safePromptBudgetTokens?: number;
  maxOutputTokens?: number;
  safetyMarginTokens?: number;
  systemTokens?: number;
  messageTokens?: number;
  usageRatio: number;
  compressedThroughMessageCount: number;
  recentRounds: number;
  turnsSinceCompression?: number;
  safeRoundLimit?: number;
  provider?: string | null;
  model?: string | null;
  triggerReason?: string;
  compressionCount: number;
  lastCompressionEstimatedTokens: number;
  updatedAt: string | null;
}

export interface ContextMemorySnapshot {
  version?: number;
  summaryText?: string;
  structured?: Record<string, unknown>;
  updatedAt?: string | null;
  compressedThroughMessageCount?: number;
  triggerReason?: string;
  compressionCount?: number;
  provider?: string | null;
  model?: string | null;
  [key: string]: unknown;
}

export interface ContextMemoryCompressionHistoryItem {
  id?: string;
  version?: number;
  compressedAt?: string | null;
  updatedAt?: string | null;
  triggerReason?: string;
  compressedThroughMessageCount?: number;
  compressionCount?: number;
  summaryText?: string;
  structured?: Record<string, unknown>;
  snapshot?: ContextMemorySnapshot;
  [key: string]: unknown;
}

export interface ContextMemoryDebug {
  current: ContextMemorySnapshot | null;
  history: ContextMemoryCompressionHistoryItem[];
}

export interface History {
  role: string;
  content: string;
  /** 系统类历史行：如主角变更 */
  kind?: string;
  at?: string;
}
