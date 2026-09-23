import type { UserGameData } from "../home/getGameData.type";
import type { Currency } from "../common/currency";

export interface PublishGameRequest {
    fileId: string;
    priceAmount: number;
    description: string;
    shareType?: Currency;
    versionNotes?: string;
    notifyFavoritedUsers?: boolean;
    audienceType?: 'male' | 'female' | 'all';
}

export interface PublishGameResponse {
    id: number;
    file_id: string;
    creator_user_id: number;
    title: string;
    subtitle: string;
    description: string;
    version_notes?: string | null;
    cover_url: string;
    doc_url: string;
    files: string;
    price_amount: number;
    special_price_amount: number | null;
    rating_avg: number | null;
    rating_count: number | null;
    created_at: string;
    updated_at: string;
    author_name: string | null;
    is_public: number;
}

export interface GameStatsResponse {
    pv: number;
    likeCount: number;
    ratingAvg: number;
    count: number;
}


export interface GameLikeRequest {
    fileId: string;
}

export interface GameLikeResponse {
    fileId: string;
    likeCount: number;
    isLiked: boolean;
    message: string;
}

export interface DeletSessionRequest{
    fileId: string;
}

export interface UpdatePriceRequest {
    fileId: string;
    price_amount: number | null;
    special_price_amount: number | null;
}

export interface UpdatePriceResponse {
    success: boolean;
    message: string;
    data?: UserGameData;
}