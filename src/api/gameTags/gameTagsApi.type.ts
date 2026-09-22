export interface GameTagTreeNode {
    id: number;
    code: string;
    name: string;
    sort_order: number;
    parent_id?: number | null;
    parent_name?: string | null;
    children?: GameTagTreeNode[];
}

export interface GameTagTreeResponse {
    success: boolean;
    data: GameTagTreeNode[];
}

export interface SetGameTagsRequest {
    fileId: string;
    tagIds: number[];
    audienceType?: 'male' | 'female' | 'all';
}

export interface SetGameTagsResponse {
    success: boolean;
    message?: string;
    data?: {
        fileId: string;
        tagIds: number[];
    };
}

export interface FeaturedGameTag {
    id: number;
    code: string;
    name: string;
    sort_order: number;
    parent_id?: number | null;
    parent_name?: string | null;
    featured_sort_order?: number | null;
}

export interface AdminGameTagRecord extends FeaturedGameTag {
    is_enabled?: number;
    is_featured: boolean;
    featured_sort_order: number | null;
    game_count: number;
    child_count: number;
}

export interface AdminGameTagListResponse {
    success: boolean;
    data: {
        tags: AdminGameTagRecord[];
        featuredTags: FeaturedGameTag[];
        featuredLimit: number;
    };
}

export interface FeaturedGameTagsResponse {
    success: boolean;
    data: FeaturedGameTag[];
}

export interface CreateAdminGameTagRequest {
    name: string;
    parentId?: number | null;
    code?: string;
    sortOrder?: number;
}

export interface UpdateAdminGameTagRequest {
    id: number;
    name?: string;
    parentId?: number | null;
    sortOrder?: number;
}
