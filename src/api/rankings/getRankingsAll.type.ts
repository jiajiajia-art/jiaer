// 「全部」Tab 排行榜聚合接口
// 后端: GET /api/auth/games/rankings/all

import type { RankingsGameItem } from './getRankings.type';

/** 每个分类 Top 5 的数据 key */
export type RankingsCategoryKey =
    | 'overall'    // 人气
    | 'new'        // 新作
    | 'hot'        // 飙升
    | 'interaction'// 畅销（互动）
    | 'rating';    // 恋爱（高分）

export interface RankingsAllResponse {
    success: boolean;
    message?: string;
    data: Partial<Record<RankingsCategoryKey, RankingsGameItem[]>>;
}
