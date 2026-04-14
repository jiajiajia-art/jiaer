export interface PromotionSubmissionConfig {
    acceptTexts: boolean;
    acceptLinks: boolean;
    acceptImages: boolean;
    acceptVideos: boolean;
    requireTexts: boolean;
    requireLinks: boolean;
    requireImages: boolean;
    requireVideos: boolean;
}

export interface HomePromotionTicker {
    id: number | null;
    text: string;
    linkUrl: string;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface HomePromotionTickerPayload {
    text: string;
    linkUrl: string;
}

export type PromotionActivityStatus = 'draft' | 'published';
export type PromotionReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'reward_pending' | 'reward_issued';
export type PromotionRewardTaskStatus = 'pending_issue' | 'issued' | 'cancelled';
export type PromotionSubmissionLimitType = 'unlimited' | 'rolling_window';

export interface PromotionActivity {
    id: number;
    title: string;
    coverImageUrl: string;
    summary: string;
    contentBody?: string;
    detailLinkUrl: string;
    submissionConfig: PromotionSubmissionConfig;
    isLongTerm: boolean;
    startAt: string | null;
    endAt: string | null;
    submissionLimitType: PromotionSubmissionLimitType;
    submissionLimitDays: number | null;
    submissionLimitCount: number | null;
    rewardPoints: number;
    canSubmit?: boolean;
    availabilityText?: string;
    status: PromotionActivityStatus;
    sortOrder: number;
    createdAt: string | null;
    updatedAt: string | null;
    publishedAt: string | null;
}

export interface PromotionSubmissionPayload {
    texts: string[];
    links: string[];
    images: string[];
    videos: string[];
}

export interface PromotionSubmission {
    id: number;
    activityId: number;
    userId: string;
    userCode: string;
    phoneNumber: string;
    nickname: string;
    submitPayload: PromotionSubmissionPayload;
    reviewStatus: PromotionReviewStatus;
    reviewRemark: string;
    rewardPoints: number | null;
    rewardTaskId: number | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    updatedAt: string | null;
    activityTitle?: string;
    activityCoverImageUrl?: string;
}

export type PromotionActivityPeriodFilter = 'all' | 'ongoing' | 'history';
export type PromotionReviewStatusFilter = 'all' | PromotionReviewStatus;

export interface AdminPromotionSubmissionFilters {
    activityId?: number;
    activityPeriod?: PromotionActivityPeriodFilter;
    reviewStatus?: PromotionReviewStatusFilter;
    keyword?: string;
    page?: number;
}

export interface AdminPromotionSubmissionPagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface AdminPromotionSubmissionListResult {
    list: PromotionSubmission[];
    pagination: AdminPromotionSubmissionPagination;
}

export interface AdminPromotionRewardTaskFilters {
    page?: number;
}

export interface AdminPromotionRewardTaskPagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface AdminPromotionRewardTaskSummary {
    pendingCount: number;
    pendingRewardPoints: number;
}

export interface PromotionRewardTask {
    id: number;
    submissionId: number;
    activityId: number;
    userId: string;
    rewardPoints: number;
    status: PromotionRewardTaskStatus;
    issuedAt: string | null;
    issuedByUserId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    activityTitle?: string;
    nickname?: string;
    userCode?: string;
    phoneNumber?: string;
}

export interface AdminPromotionRewardTaskListResult {
    list: PromotionRewardTask[];
    pagination: AdminPromotionRewardTaskPagination;
    summary: AdminPromotionRewardTaskSummary;
}

export interface PromotionActivityPayload {
    title: string;
    coverImageUrl: string;
    summary: string;
    contentBody?: string;
    detailLinkUrl: string;
    submissionConfig: PromotionSubmissionConfig;
    isLongTerm: boolean;
    startAt: string | null;
    endAt: string | null;
    submissionLimitType: PromotionSubmissionLimitType;
    submissionLimitDays: number | null;
    submissionLimitCount: number | null;
    rewardPoints: number;
    status: PromotionActivityStatus;
    sortOrder: number;
}

export type AdminPointsLookupMode = 'userCode' | 'phoneNumber';
export type AdminManualPointChangeType = 'increment' | 'decrement';

export interface AdminPointsUserLookupResult {
    userId: string;
    nickname: string;
    userCode: string;
    phoneNumber: string;
    points: number;
}

export interface AdminManualPointAdjustPayload {
    userId: string;
    changeType: AdminManualPointChangeType;
    points: number;
    remark: string;
}

export interface AdminManualPointAdjustResult {
    user: AdminPointsUserLookupResult;
    activity: {
        userId: string;
        activityId: string;
        activityType: 'admin_manual_adjust';
        points: number;
        description: string;
        status: number;
        createdAt: string;
        updatedAt: string;
    };
}
