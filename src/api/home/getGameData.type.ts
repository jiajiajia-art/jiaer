export interface UserGameData {
    id: string;
    file_id: string;
    creator_user_id: string | number;
    title: string;
    subtitle: string;
    description: string;
    version_notes?: string | null;
    cover_url: string;
    doc_url: string;
    files: string;
    version?: string | number;
    price_amount: number|null;
    special_price_amount: number;
    rating_avg: string|null;
    rating_count: number|null;
    created_at: string;
    updated_at: string;
    author_name: string;
    is_public: number;
    like_count: number;
    dislike_count: number;
    reaction: string;
    avatarUrl: string;
    total_uv_count?: number;
    total_pv_count?: number;
    paid?: boolean;
    game_tags: string;
    is_preset: number;
    // 新增：游戏引擎类型（服务端为准）与自定义游戏的 AppId（用于 Custom IF）
    // RPG -> story, TXT -> galgame, AVG -> world, CUSTOM -> customif, IVG -> interactive-video
    engine?: 'RPG' | 'TXT' | 'AVG' | 'CUSTOM' | 'IVG'| 'NOVEL';
    playbackOrientation?: 'landscape' | 'portrait';
    customAppId?: string;
    needDeleted: boolean;
    display_cover_url: string;
    source_file_id?: string | null;
    source_replay_id?: string | null;
    source_author_name?: string | null;
    source_author_user_id?: string | null;
    novel_content_version?: string | null;
    theme_tag_ids?: number[];
    theme_tag_names?: string[];
    /** 以下为激励计划相关的可选字段（由服务端逐步补充，前端做兼容） */
    /** 作品激励开始时间（ISO 字符串），为空表示未参与 */
    incentiveStartTime?: string | null;
    /** 作品激励结束时间（ISO 字符串），为空表示未结束 */
    incentiveEndTime?: string | null;
    /** 作品激励状态：none | running | finished（服务端也可能返回下划线命名） */
    incentiveStatus?: 'none' | 'running' | 'finished' | string;
    /** 作品当前激励金额（服务端计算），缺失时前端可按 UV×5 做兜底展示 */
    incentiveAmount?: number;
    /** 作品激励中-待结算金额 */
    incentivePendingAmount?: number;
    /** 作品激励已结算金额（激励结束后的最终值） */
    incentiveSettledAmount?: number;
    /** 兼容服务端可能的下划线命名 */
    incentive_status?: 'none' | 'running' | 'finished' | string;
    incentive_amount?: number;
    incentive_pending_amount?: number;
    incentive_settled_amount?: number;
    /** QQ群号，有值则渲染 */
    groupNo?: string;
    /** 当前用户是否已收藏该游戏 */
    isFavorited?: boolean;
}

export interface UserGameResponse {
    success: boolean;
    data: UserGameData[];
}

export interface UserGameRequest{
    limit?: number;
}

export interface PublicGameRequest {
    limit?: string;
    offset?: string;
    tagId?: string;
    mode?: string;
    sort?: string;
}

export interface PublicGameSearchRequest {
    q: string;
    page?: number;
    pageSize?: number;
    sort?: 'relevance' | 'newest' | 'rating_desc' | 'price_asc';
}

export interface PublicGameSearchPagination {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
}

export interface PublicGameSearchResponse {
    success: boolean;
    data: UserGameData[];
    pagination: PublicGameSearchPagination;
}

export interface GameDetailRequest {
    fileId: string;
}

export interface GameDetailResponse {
    success: boolean;
    data: UserGameData;
}

export interface GamePlayStatusData {
    hasContinueState: boolean;
    hasSave: boolean;
}

export interface GamePlayStatusResponse {
    success: boolean;
    message?: string;
    data: GamePlayStatusData;
}

export interface WareHouseResponse {
    success: boolean;
    data: {
        rows:UserGameData[];
    }
}
