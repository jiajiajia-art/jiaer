import { api } from "../base";
import type { CreateWorldSessionResponse, GetWorldFilesBySessionResponse } from "./createWorldSession.type";
export interface CreateWorldSessionRequest {
    presetId?: string;
    fileId?: string;
}
const createWorldSessionApi = {
    createWorldSession: (data:CreateWorldSessionRequest) =>
        api.post<CreateWorldSessionResponse>(`/worldInteraction/session/create`, data),
    getWorldFilesBySession: (sessionId: string) =>
        api.get<GetWorldFilesBySessionResponse>(`/world-interaction/session/${sessionId}`),
}

export default createWorldSessionApi;