import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { CreateSessionRequest, CreateSessionResponse, GetSessionRequest, GetSessionResponse } from "./createSessionApi.type";

const createSessionApi = {
  createSession: (data: CreateSessionRequest) =>
    api.post<CreateSessionResponse>('/backend/game/session/create', data),
  getSession: (data: GetSessionRequest) =>
    api.post<ApiResponse<GetSessionResponse>>(`/auth/games/session/create`, data, { timeout: 0 },
    ),
};

export default createSessionApi;