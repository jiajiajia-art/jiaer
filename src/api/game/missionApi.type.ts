import { api } from "../base";
import type { MissionResponse } from "./missionApi";

const MissionApi = {
    getMissions: (sessionId: string) => api.post<MissionResponse>(`/backend/game/session/${sessionId}/missions/`),
}

export default MissionApi;