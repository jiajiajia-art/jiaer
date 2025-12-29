import { api } from "../base";
import type { GetGalgameHistoryResponse, GetGalgamePresetResponse } from "./getGalgamePreset.type";

const getGalgamePresetApi = {
    getGalgamePreset: (presetId: string) =>
        api.get<GetGalgamePresetResponse>(`/visual/presets/${presetId}`),
    getGalgameFileId: (fileId: string) =>
        api.get<GetGalgamePresetResponse>(`/visual/document/${fileId}`),
    getGalgameMusic: (presetId: string, musicId: string) => {
        return api.get(`/visual/${presetId}/music/${musicId}`, {
            responseType: 'blob'
        });
    },
    getGalgameHistory: (sessionId: string) =>
        api.get<GetGalgameHistoryResponse>(`/visual/session/${sessionId}/history`),
};

export default getGalgamePresetApi;

