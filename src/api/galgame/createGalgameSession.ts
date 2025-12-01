import { api } from "../base";
import type { CreateGalgameSessionResponse } from "./createGalgameSession.type";

const createGalgameSessionApi = {
    createGalgameSession: ({presetId}: {presetId: string}) =>
        api.post<CreateGalgameSessionResponse>(`/visual/session/create`, {presetId}),
}

export default createGalgameSessionApi;