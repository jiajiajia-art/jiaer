import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { GameFilesResponse, ScenesResponse } from "./gameData.type";

const gameDataApi = {
  getGameFiles: (sessionId: string) =>
    api.get<GameFilesResponse & { success: boolean }>(`/backend/files/${sessionId}`),

  getSingleFile: (sessionId: string, fileType: string) =>
    api.get<ApiResponse<ScenesResponse>>(`/backend/files/${sessionId}/${fileType}`),

  getPlayerAvatar: (fileId: string) =>
    api.get(`/backend/images/${fileId}/player`, {
      responseType: 'blob', 
    }),

  getWorldMap: (fileId: string) =>
    api.get(`/backend/images/${fileId}/world`, {
      responseType: 'blob',
    }),
};

export default gameDataApi;

