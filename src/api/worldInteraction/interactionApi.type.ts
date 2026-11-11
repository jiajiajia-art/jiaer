// event.types.ts

export interface GameEvent {
  eventId: string;
  eventTitle: string;
  eventDescription: string;
  eventType: string;
  targetNpcId: string;
  targetSubsceneId: string;
  relatedKeyEventIndex?: number;
  status: string;
  createdAt: string;
  round?: number;
  npcSelectionReason?: string;
  npc: NPCInfo;
  subscene: SubsceneInfo;
  [key: string]: any;
}

export interface NPCInfo {
  id: string;
  name: string;
  image: string;
  [key: string]: any;
}

export interface SubsceneInfo {
  id: string;
  name: string;
  parentSceneName: string;
  [key: string]: any;
}

export interface EventResponse {
  success: boolean;
  message: string;
  event: GameEvent;
  npc: NPCInfo;
  subscene: SubsceneInfo;
  [key: string]: any;
}

// 基础图像接口
export interface NpcImages {
  [key: string]: string;
}

// 选项接口
export interface GameOption {
  optionId: string;
  text: string;
  type: string;
  consequence: string;
}

// 叙述步骤
export interface NarrationStep {
  type: "narration";
  content: string;
}

// 对话步骤
export interface DialogueStep {
  type: "dialogue";
  speakerId: string;
  npcId: string;
  content: string;
  speakerName: string;
  npcImages: NpcImages;
  activeImage: string;
}

// 选择步骤
export interface ChoiceStep {
  type: "choice";
  title: string;
  description: string;
  options: GameOption[];
}

// 所有步骤类型的联合
export type NarrativeStep = NarrationStep | DialogueStep | ChoiceStep;

// NPC对话事件（玩家未选择时）
export interface NpcDialogueEvent {
  type: "npc_dialogue";
  eventId: string;
  eventTitle: string;
  npcId: string;
  npcName: string;
  subsceneId: string;
  subsceneName: string;
  narrativeSteps: NarrativeStep[];
  options: GameOption[];
  round: number;
  timestamp: string;
}

// 玩家选择事件
export interface PlayerChoiceEvent {
  type: "player_choice";
  eventId: string;
  eventTitle: string;
  npcId: string;
  npcName: string;
  subsceneId: string;
  subsceneName: string;
  selectedOption: GameOption;
  npcResponse: (NarrationStep | DialogueStep)[];
  round: number;
  timestamp: string;
}

// 所有交互事件的联合类型
export type GameInteraction = NpcDialogueEvent | PlayerChoiceEvent;

// 主响应接口
export interface GetWorldInteractionHistoryResponse {
  success: boolean;
  sessionId: string;
  interactions: GameInteraction[];
  count: number;
}

export interface GetActiveEventsResponse {
  success: boolean;
  events: GameEvent[];
  count: number;
}


export interface NextRoundResponse {
  success: boolean;
  message: string;
  currentRound: number;
  currentKeyEventIndex: number;
  activeEvents: GameEvent[];
}

