import { api } from "../base";
import type { CreateWorldSessionResponse } from "./createWorldSession.type";

const createWorldSessionApi = {
    createWorldSession: ({fileId}: {fileId: string}) =>
        api.post<CreateWorldSessionResponse>(`/world-interaction/session/create`, {fileId}),
}

export default createWorldSessionApi;