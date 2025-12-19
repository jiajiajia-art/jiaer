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
    total_pv_count?: number;
    paid?: boolean;
    version: string;
    game_tags: string[];
    is_preset: number;
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