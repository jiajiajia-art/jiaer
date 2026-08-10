import type { ApiResponse } from "../api.types";
import { api } from "../base";
import { dedupeInflight } from "../../lib/dedupeInflight";
import type { GetGalgameHistoryResponse, GetGalgamePresetResponse } from "./getGalgamePreset.type";

const historyInflight = new Map<string, Promise<unknown>>();

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
    ) => {
        const key = `${sessionId}|${JSON.stringify(params || {})}`;
        return dedupeInflight(historyInflight, key, () =>
            api.get<GetGalgameHistoryResponse>(`/visual/session/${sessionId}/history`, { params })
        ) as ReturnType<typeof api.get<GetGalgameHistoryResponse>>;
    },
};

export default getGalgamePresetApi;
