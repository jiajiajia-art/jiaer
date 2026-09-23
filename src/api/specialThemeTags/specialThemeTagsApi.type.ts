import type { UserGameData } from '../home/getGameData.type';

export type SpecialThemeConfigMode = 'manual' | 'auto';
export type SpecialThemeAutoSort = 'hot' | 'recommended' | 'latest';
export type SpecialThemeAudienceGender = 'male' | 'female';

export interface SpecialThemeSelectedGame {
    file_id: string;
    gender_target?: SpecialThemeAudienceGender | 'all' | '';
    title: string;
    description: string;
    cover_url: string;
    link_url: string;
    updated_at: string | null;
    is_public: number;
    sort_order: number;
}

export interface SpecialThemeTagRecord {
    id: number;
    code: string;
    name: string;
    config_mode: SpecialThemeConfigMode;
    auto_sort: SpecialThemeAutoSort | null;
    sort_order: number;
    is_enabled: boolean;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface AdminSpecialThemeTagRecord extends SpecialThemeTagRecord {
    selected_games: SpecialThemeSelectedGame[];
    selected_games_by_gender?: Record<SpecialThemeAudienceGender, SpecialThemeSelectedGame[]>;
    selected_game_count: number;
    selected_game_count_by_gender?: Record<SpecialThemeAudienceGender, number>;
}

export interface AdminSpecialThemeTagListResponse {
    success: boolean;
    data: {
        tags: AdminSpecialThemeTagRecord[];
        manualLimit: number;
    };
}

export interface CreateSpecialThemeTagRequest {
    name: string;
    configMode: SpecialThemeConfigMode;
    autoSort?: SpecialThemeAutoSort | null;
}

export interface UpdateSpecialThemeTagRequest extends CreateSpecialThemeTagRequest {
    id: number;
    isEnabled?: boolean;
}

export interface ReorderSpecialThemeTagsRequest {
    ids: number[];
}

export interface SaveSpecialThemeGamesRequest {
    fileIds?: string[];
    maleFileIds?: string[];
    femaleFileIds?: string[];
}

export interface SpecialThemeTagMutationResponse {
    success: boolean;
    message?: string;
    data?: AdminSpecialThemeTagRecord | SpecialThemeTagRecord | boolean | {
        tags: AdminSpecialThemeTagRecord[];
        manualLimit: number;
    };
}

export interface PublicSpecialThemeTagListResponse {
    success: boolean;
    data: SpecialThemeTagRecord[];
}

export interface PublicSpecialThemeTagGamesResponse {
    success: boolean;
    data: UserGameData[];
}
