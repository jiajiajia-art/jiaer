import { api } from "../base";
import type { ModifyPlayerRequest, ModifyPlayerResponse } from "./modeifyPlayer.type";

const ModeifyPlayer = {
  ModeifyPlayerName: (sessionId: string, data: ModifyPlayerRequest) =>
    api.put<ModifyPlayerResponse>(`/backend/game/session/${sessionId}/player/name`, data),
};

export default ModeifyPlayer;