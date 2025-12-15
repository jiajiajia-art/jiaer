import { api } from "../base";
import type { WorldInteractionGameData } from "./worldInteractionApi.type";

const MapWorldData = {
    getMapWorldData: (fileId: string) =>
        api.get<WorldInteractionGameData>(`/world-interaction/files/${fileId}`),
}

export default MapWorldData;