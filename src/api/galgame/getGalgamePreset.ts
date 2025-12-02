import { api } from "../base";
import type { GetGalgamePresetResponse } from "./getGalgamePreset.type";

const getGalgamePresetApi = {
    getGalgamePreset: (presetId: string) =>
        api.get<GetGalgamePresetResponse>(`/visual/presets/${presetId}`),
    getMusic: (presetId: string, musicId: string) => {
        return api.get(`/visual/presets/${presetId}/musics/${musicId}`, {
            responseType: 'blob'
        });
    }
};

export default getGalgamePresetApi;

