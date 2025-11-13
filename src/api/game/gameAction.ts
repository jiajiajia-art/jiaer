import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { GameLikeRequest, GameLikeResponse, GameStatsResponse, PublishGameRequest, PublishGameResponse } from "./gameAction.Api";

const GameAction = {
    deleteGame: (fileId: string) => api.delete(`/auth/games/delete/${fileId}`),
    publishGame: (data: PublishGameRequest) => api.post<ApiResponse<PublishGameResponse>>(`/auth/games/publish`, data),
    getGameStats: (fileId: string) => api.get<ApiResponse<GameStatsResponse>>(`/auth/games-stats/data/${fileId}`),
    gameLike: (data: GameLikeRequest) => api.post<ApiResponse<GameLikeResponse>>(`/auth/games-stats/like`, data),
}

export default GameAction;