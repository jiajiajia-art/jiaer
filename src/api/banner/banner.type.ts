export type BannerStatus = 'published';

export interface BannerItem {
    id: string;
    game_file_id?: string;
    image_url: string;
    game_image_url?: string;
    custom_image_url?: string;
    title: string;
    description: string;
    link_url: string;
}

export interface BannerRecord {
    id: number;
    status: BannerStatus;
    banners: BannerItem[];
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
}

export interface BannerCurrentData {
    published: BannerRecord | null;
}

export interface BannerPayload {
    banners: BannerItem[];
}

export interface BannerGameOption {
    file_id: string;
    title: string;
    description: string;
    cover_url: string;
    link_url: string;
    updated_at: string | null;
}
