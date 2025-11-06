import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { CreateSessionRequest, CreateSessionResponse } from "./createSession";

const createSession = {
  createSession: (data: CreateSessionRequest) =>
    api.post<ApiResponse<CreateSessionResponse>>('/backend/game/session/create', data),
};

export default createSession;