import { api } from "../base";
import type { MissionResponse, SubmitMissionResponse } from "./missionApi.type";

const MissionApi = {
    getMissions: (sessionId: string) => api.get<MissionResponse>(`/backend/game/session/${sessionId}/missions/`),
    submitMission: (sessionId: string, missionId: string) => api.post<SubmitMissionResponse>(`/backend/game/session/${sessionId}/missions/${missionId}/submit`),
}

export default MissionApi;