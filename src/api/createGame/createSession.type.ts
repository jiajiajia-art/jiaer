import { api } from "../base";
import type { CreateSessionRequest, CreateSessionResponse } from "./createSession";

const createSessionApi = {
  createSession: (data: CreateSessionRequest) =>
    api.post<CreateSessionResponse>('/backend/game/session/create', data),
};

export default createSessionApi;