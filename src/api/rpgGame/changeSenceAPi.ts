import type { ChangeSceneRequest, ChangeSceneResponse } from "./changeSence.type";
import { api } from "../base";

const changeSceneApi = {
    changeScene: (
        sessionId: string,
        data: ChangeSceneRequest
    ) => api.post<ChangeSceneResponse>(`/backend/game/session/${sessionId}/change-scene`, data),
}

export default changeSceneApi;