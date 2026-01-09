/**
 * 交互类型
 */
export const InteractionType = {
  /** 普通NPC对话交互 */
  NPC_DIALOGUE: 'npc_dialogue',
  /** 功能性NPC交互 */
  ABILITY_NODE: 'ability_node',
} as const;

export type InteractionType = typeof InteractionType[keyof typeof InteractionType];

/**
 * 交互模式
 */
export const InteractionMode = {
  /** 普通模式（显示立绘和背景） */
  NORMAL: 'normal',
  /** 文本模式（纯文本显示） */
  TEXT: 'text',
} as const;

export type InteractionMode = typeof InteractionMode[keyof typeof InteractionMode];

/**
 * 播放模式
 */
export const PlaybackMode = {
  /** 手动播放 */
  MANUAL: 'manual',
  /** 自动播放 */
  AUTO: 'auto',
} as const;

export type PlaybackMode = typeof PlaybackMode[keyof typeof PlaybackMode];

/**
 * 交互状态
 */
export const InteractionStatus = {
  /** 空闲 */
  IDLE: 'idle',
  /** 初始化中 */
  INITIALIZING: 'initializing',
  /** 等待数据 */
  WAITING: 'waiting',
  /** 播放中 */
  PLAYING: 'playing',
  /** 已完成 */
  COMPLETED: 'completed',
} as const;

export type InteractionStatus = typeof InteractionStatus[keyof typeof InteractionStatus];

/**
 * 交互配置
 */
export interface InteractionConfig {
  /** 交互类型 */
  type: InteractionType;
  /** 交互模式 */
  mode: InteractionMode;
  /** 播放模式 */
  playback: PlaybackMode;
  /** 是否跳过自动初始化 */
  skipAutoInit: boolean;
  /** 当前子场景ID（用于功能性NPC交互） */
  currentSubsceneId?: string | null;
  /** 待处理的操作（功能性NPC） */
  pendingAction?: { nodeId: string; actionId: string } | null;
}

/**
 * 交互状态
 */
export interface InteractionState {
  /** 当前状态 */
  status: InteractionStatus;
  /** 游戏是否已开始 */
  gameStarted: boolean;
  /** 是否有待处理请求 */
  hasPendingRequest: boolean;
  /** 已完成步骤 */
  completedSteps: any[];
  /** 历史记录是否可见 */
  isHistoryVisible: boolean;
}

