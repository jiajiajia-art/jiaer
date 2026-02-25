export interface UserGameData {
    id: string;
    file_id: string;
    creator_user_id: number;
    title: string;
    subtitle: string;
    description: string;
    cover_url: string;
    doc_url: string;
    files: string;
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
    // RPG → story, TXT → galgame, AVG → world, CUSTOM → customif
    engine?: 'RPG' | 'TXT' | 'AVG' | 'CUSTOM';
    customAppId?: string;
    needDeleted: boolean;
    display_cover_url: string;
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
}

export interface GameDetailRequest {
    fileId: string;
}

export interface GameDetailResponse {
    success: boolean;
    data: UserGameData;
}


export interface WareHouseResponse {
    success: boolean;
    data: {
        rows:UserGameData[];
    }
}
