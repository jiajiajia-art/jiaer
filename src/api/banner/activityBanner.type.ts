export type ActivityBannerLifecycle = 'scheduled' | 'active' | 'expired';

export interface ActivityBannerItem {
    id: number;
    imageUrl: string;
    title: string;
    description: string;
    linkUrl: string;
    startAt: string | null;
    endAt: string | null;
    sortOrder: number;
    workflowStatus: 'draft' | 'staged';
    isPublished: boolean;
    lifecycle: ActivityBannerLifecycle;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
}

export interface ActivityBannerDraft {
    id: number;
    imageUrl: string;
    title: string;
    description: string;
    linkUrl: string;
    startAt: string | null;
    endAt: string | null;
    sortOrder: number;
}

export interface ActivityBannerAdminData {
    staged: ActivityBannerItem[];
    drafts: ActivityBannerItem[];
}

export interface ActivityBannerPublicData {
    banners: ActivityBannerItem[];
    nextChangeAt: string | null;
}

export interface ActivityBannerPublishPayload {
    banners: ActivityBannerDraft[];
}
