import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { ConversionRequest, ConversionResponse, GameTotalStatsResponse, ViewRequest, ViewResponse } from "./statisticsApi.type";

const statisticsApi = {
    addConversion: (data: ConversionRequest) => {
        return api.post<ApiResponse<ConversionResponse>>('/auth/games-stats/conversion', data);
    },
    addView: (data: ViewRequest) => {
        return api.post<ApiResponse<ViewResponse>>('/auth/games-stats/visit', data);
    },
    getALLGameStats: ( data:{userId: string}) => {
        return api.get<ApiResponse<GameTotalStatsResponse>>('/auth/games-stats/total-data', { params: data });
    }
}

export default statisticsApi;