import { api } from "../base";
import type { SkipEraResponse } from "./skipEraApi.type";

const skipEraApi = {
    skipEra: (sessionId: string) => api.post<SkipEraResponse>(`/backend/game/session/${sessionId}/skip-to-era`),
}

export default skipEraApi;