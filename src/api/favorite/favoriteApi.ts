import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { UserGameData } from '../home/getGameData.type';

export interface GameFavoriteToggleRequest {
  fileId: string;
}

export interface GameFavoriteToggleResponse {
  fileId: string;
  isFavorited: boolean;
  /** 服务端收藏人数，切换后以前端展示为准 */
  favoriteCount?: number;
}

export interface GameFavoritesListResponse {
  rows: UserGameData[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const favoriteApi = {
  toggle: (data: GameFavoriteToggleRequest) =>
    api.post<ApiResponse<GameFavoriteToggleResponse>>('/auth/games/favorites/toggle', data),

  list: (params?: { limit?: string; offset?: string }) =>
    api.get<ApiResponse<GameFavoritesListResponse>>('/auth/games/favorites', { params }),
};

export default favoriteApi;
