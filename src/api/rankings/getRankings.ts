// 游戏排行榜 API 封装
import { api } from "../base";
import type {
    GetRankingsRequest,
    RankingsAuthorListResponse,
    RankingsListResponse,
} from "./getRankings.type";
import type { RankingsAllResponse } from './getRankingsAll.type';

const getRankingsApi = {
    /**
     * 获取游戏排行榜列表
     * GET /api/auth/games/rankings
     * - 登录态可选；未登录时 paid 字段可能为 undefined，按未登录展示即可
     */
    getRankings: (params: GetRankingsRequest = {}) => {
        return api.get<RankingsListResponse>('/auth/games/rankings', { params });
    },
    /**
     * 作者榜：按公开作品游玩轮次加总
     * GET /api/auth/games/rankings?type=authors
     */
    getAuthorRankings: (params: Omit<GetRankingsRequest, 'type'> = {}) => {
        return api.get<RankingsAuthorListResponse>('/auth/games/rankings', {
            params: { ...params, type: 'authors' },
        });
    },
    /**
     * 「全部」Tab 聚合接口：作品榜 + 作者榜 Top 5
     * GET /api/auth/games/rankings/all
     */
    getRankingsAll: () => {
        return api.get<RankingsAllResponse>('/auth/games/rankings/all');
    },
};

export default getRankingsApi;
