// 游戏排行榜接口响应类型与参数
// 后端: GET /api/auth/games/rankings

/**
 * 接口支持的 type 值
 *  - overall     总榜（按总点赞数降序）
 *  - new         新作榜（30天内发布的游戏，按点赞数降序）
 *  - hot         高人气榜（近7天增量点赞聚合降序）
 *  - rating      高分榜（按评分均分降序）
 *  - interaction 互动榜（分享数 + 评论数综合降序）
 */
export type RankingsApiType = 'overall' | 'new' | 'hot' | 'rating' | 'interaction';

export interface RankingsGameItem {
    file_id: string;
    title: string;
    subtitle: string;
    description: string;
    cover_url: string;
    display_cover_url: string;
    engine: string;
    game_tags: string;
    price_amount: number;
    special_price_amount: number | null;
    like_count: number;
    dislike_count: number;
    rating_avg: number;
    rating_count: number;
    creator_user_id: string;
    author_name: string;
    created_at: string;
    updated_at: string;
    version: string;
    is_public: number;
    /** 登录后才会有值：当前用户是否已购买或为创作者 */
    paid: boolean;
    total_pv_count: number;
    total_uv_count: number;
    theme_tag_ids: number[];
    theme_tag_names: string[];
}

export interface RankingsListResponse {
    success: boolean;
    message?: string;
    data: RankingsGameItem[];
}

export interface GetRankingsRequest {
    type?: RankingsApiType;
    limit?: number;
    offset?: number;
}
