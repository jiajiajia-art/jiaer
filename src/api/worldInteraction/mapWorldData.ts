import { api } from "../base";
import type { WorldInteractionGameData } from "./worldInteractionApi.type";

const MapWorldData = {
  getMapWorldData: (fileId: string) =>
    api.get<WorldInteractionGameData>(`/world-interaction/document/${fileId}`,{
        timeout: 1500000
    }),
  getMapGalgameMusic: (fileId: string, musicId: string) => {
    return api.get(
      `/world-interaction/${fileId}/music/${encodeURIComponent(musicId)}`,
      {
        responseType: "blob",
        headers: {
          "Cache-Control": "no-cache", // 强制获取新资源，避免 304 响应导致的问题
        },
      }
    );
  },
};

export default MapWorldData;
