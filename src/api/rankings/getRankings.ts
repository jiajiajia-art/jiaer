// 游戏排行榜 API 封装
import { api } from "../base";
import type {
    GetRankingsRequest,
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
     * 「全部」Tab 聚合接口：一次性返回 5 个分类各 Top 5
     * GET /api/auth/games/rankings/all
     */
    getRankingsAll: () => {
        return api.get<RankingsAllResponse>('/auth/games/rankings/all');
    },
};

export default getRankingsApi;
