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
    userId: string;
}

export interface GameDetailRequest {
    fileId: string;
    userId: string;
}

export interface GameDetailResponse {
    success: boolean;
    data: UserGameData;
}