import { api } from "../base";
import type { EventResponse } from "./interactionApi.type";

const interactionApi = {
    distributeEvent: ({
        fileId,
        sessionId,
    }: {
        fileId: string,
        sessionId: string,
    }) =>
        api.post<EventResponse>(`/world-interaction/session/${sessionId}/distribute-event`, {fileId},{timeout: 0}),
}

export default interactionApi;