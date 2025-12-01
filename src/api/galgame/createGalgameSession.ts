import { api } from "../base";
import type { CreateGalgameSessionResponse } from "./createGalgameSession.type";

const createGalgameSessionApi = {
    createGalgameSession: (
        presetId: string,
    ) => api.post<CreateGalgameSessionResponse>(`/backend/game/session/${presetId}/create-galgame-session`),
}

export default createGalgameSessionApi;