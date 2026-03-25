import { api } from "../base";
import type { CreateGalgameEditSessionRequest, CreateGalgamePlaySessionRequest, CreateGalgameSessionResponse } from "./createGalgameSession.type";

const createGalgameSessionApi = {
    // 玩家游玩会话（有存档）
    createGalgamePlaySession: (data: CreateGalgamePlaySessionRequest) =>
        api.post<CreateGalgameSessionResponse>(`/optical/games/session/create`, data),
    // 创作编辑会话（不需要存档）
    createGalgameEditSession: ({fileId, saveId}: {fileId: string; saveId?: string}) =>
        api.post<CreateGalgameEditSessionRequest>(`/visual/session/create`, saveId ? { fileId, saveId } : { fileId }),
}

export default createGalgameSessionApi;
