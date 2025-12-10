// event.types.ts

export interface GameEvent {
    eventId: string;
    eventTitle: string;
    eventDescription: string;
    eventType: string;
    targetNpcId: string;
    targetSubsceneId: string;
    relatedKeyEventIndex?: number;
    estimatedImportance?: number;
    reason?: string;
    status: string;
    createdAt: string;
    round?: number;
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