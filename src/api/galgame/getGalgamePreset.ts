import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { GetGalgameHistoryResponse, GetGalgamePresetResponse } from "./getGalgamePreset.type";

const getGalgamePresetApi = {
    // getGalgamePreset: (presetId: string) =>
    //     api.get<GetGalgamePresetResponse>(`/visual/presets/${presetId}`),
    getGalgameFileId: (fileId: string) =>
        api.get<ApiResponse<GetGalgamePresetResponse>>(`/visual/document/${fileId}`),
    getGalgameMusic: (presetId: string, musicId: string) => {
        return api.get(`/visual/musics/${presetId}/${musicId}`, {
            responseType: 'blob'
        });
    },
    getGalgameHistory: (
        sessionId: string,
        params?: { offset?: number; limit?: number; direction?: 'before' | 'after'; debugContextMemory?: 1 | '1' | boolean }
    ) =>
        api.get<GetGalgameHistoryResponse>(`/visual/session/${sessionId}/history`, { params }),
};

export default getGalgamePresetApi;

