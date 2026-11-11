export type BannerStatus = 'published';
export type BannerAudience = 'common' | 'male' | 'female';

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

export type BannerGroups = Record<BannerAudience, BannerItem[]>;

export interface AdminBannerRecord extends BannerRecord {
    bannerGroups: BannerGroups;
}

export interface BannerCurrentData {
    published: AdminBannerRecord | null;
}

export interface BannerPayload {
    bannerGroups: BannerGroups;
}

export interface BannerGameOption {
    file_id: string;
    title: string;
    description: string;
    cover_url: string;
    link_url: string;
    updated_at: string | null;
}
