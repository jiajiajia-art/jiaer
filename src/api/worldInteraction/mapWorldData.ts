import { api } from "../base";
import type { AllGameData } from "./mapWorldData.type";

const MapWorldData = {
    getMapWorldData: (fileId: string) =>
        api.get<AllGameData>(`/world-interaction/files/${fileId}`),
}

export default MapWorldData;