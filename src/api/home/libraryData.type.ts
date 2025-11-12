export interface LibraryData {
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
}

export interface LibraryDataResponse {
    success: boolean;
    data: LibraryData[];
}

export interface LibraryRequest{
    limit?: number;
}