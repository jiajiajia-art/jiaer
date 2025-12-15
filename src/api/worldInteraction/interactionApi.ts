import { api } from "../base";
import type { EventResponse } from "./interactionApi.type";

interface NextRoundResponse {
    success: boolean;
    message: string;
    currentRound: number;
    currentKeyEventIndex: number;
    activeEvents: Array<{
        eventId: string;
        eventTitle: string;
        eventDescription: string;
        eventType: string;
        targetNpcId: string;
        targetSubsceneId: string;
        relatedKeyEventIndex: number;
        estimatedImportance: number;
        reason: string;
        status: string;
        createdAt: string;
        round: number;
    }>;
}

const interactionApi = {
    distributeEvent: ({
        sessionId,
    }: {
        sessionId: string,
    }) =>
        api.post<EventResponse>(
            `/world-interaction/session/${sessionId}/distribute-event`,
            {},
            { timeout: 1500000 },
        ),
    
    nextRound: (sessionId: string) =>
        api.post<NextRoundResponse>(`/world-interaction/session/${sessionId}/next-round`, {}, {timeout: 0}),
}

export default interactionApi;