import { api } from "../base";
import type { CreateGalgameEditSessionRequest, CreateGalgameSessionResponse } from "./createGalgameSession.type";

const createGalgameSessionApi = {
    // 玩家游玩会话（有存档）
    createGalgamePlaySession: ({presetId}: {presetId: string}) =>
        api.post<CreateGalgameSessionResponse>(`/optical/games/session/create`, {presetId}),
    // 创作编辑会话（不需要存档）
    createGalgameEditSession: ({fileId}: {fileId: string}) =>
        api.post<CreateGalgameEditSessionRequest>(`/visual/session/create`, {fileId}),
}

export default createGalgameSessionApi;