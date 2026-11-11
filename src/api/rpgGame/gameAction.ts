import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { DeletSessionRequest, GameLikeRequest, GameLikeResponse, GameStatsResponse, PublishGameRequest, PublishGameResponse, UpdatePriceRequest, UpdatePriceResponse } from "./gameAction.Api";

const GameAction = {
    deleteGame: (fileId: string) => api.delete(`/auth/games/delete/${fileId}`),
    publishGame: (data: PublishGameRequest) => api.post<ApiResponse<PublishGameResponse>>(`/auth/games/publish`, data),
    unpublishGame: (data:{fileId: string}) => api.post<ApiResponse<PublishGameResponse>>(`/auth/games/unpublish`, data),
    getGameStats: (fileId: string) => api.get<ApiResponse<GameStatsResponse>>(`/auth/games-stats/data/${fileId}`),
    gameLike: (data: GameLikeRequest) => api.post<ApiResponse<GameLikeResponse>>(`/auth/games-stats/like`, data),
    deletGameSession: (data: DeletSessionRequest) => api.delete('/auth/games/session', { data }),
    updatePrice: (data: UpdatePriceRequest) => api.post<ApiResponse<UpdatePriceResponse>>(`/auth/games/price/update`, data)
}

export default GameAction;