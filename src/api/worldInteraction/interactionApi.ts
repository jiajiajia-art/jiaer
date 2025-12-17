import { api } from "../base";
import type { EventResponse, GetActiveEventsResponse, GetWorldInteractionHistoryResponse, NextRoundResponse } from "./interactionApi.type";

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
    getWorldInteractionHistory: (sessionId: string) =>
        api.get<GetWorldInteractionHistoryResponse>(`/world-interaction/session/${sessionId}/history`),
    getActiveEvents: (sessionId: string) =>
        api.get<GetActiveEventsResponse>(`/world-interaction/session/${sessionId}/events/active`),
}

export default interactionApi;