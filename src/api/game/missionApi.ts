import { api } from "../base";
import type { MissionResponse } from "./missionApi.type";

const MissionApi = {
    getMissions: (sessionId: string) => api.get<MissionResponse>(`/backend/game/session/${sessionId}/missions/`),
}

export default MissionApi;