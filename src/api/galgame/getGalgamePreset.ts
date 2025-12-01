import { api } from "../base";
import type { GetGalgamePresetResponse } from "./getGalgamePreset.type";

const getGalgamePresetApi = {
    getGalgamePreset: (presetId: string) =>
        api.get<GetGalgamePresetResponse>(`/visual/presets/${presetId}`),
};

export default getGalgamePresetApi;

