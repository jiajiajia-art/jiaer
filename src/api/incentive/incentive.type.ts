export type AdminIncentiveLookupMode = 'userCode' | 'phoneNumber';

export type UserSegment = 'normal' | 'game_incentive' | 'incentive' | 'code_incentive';

export interface AdminIncentiveAuthorInfo {
    userId: string;
    nickname: string;
    userCode: string;
    phoneNumber: string;
    role: string;
    userSegment: UserSegment;
    incentiveEnabled: boolean;
}

export interface AdminIncentiveAuthorListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    enabled?: boolean;
    userSegment?: UserSegment;
}

export type IncentiveStatus = 'none' | 'code_incentive' | 'game_incentive' | 'incentive' | 'finished';

export interface AdminIncentiveGameRecord {
    fileId: string;
    creatorUserId: string;
    title: string;
    subtitle: string;
    isPublic: number;
    incentiveStartTime: string | null;
    incentiveEndTime: string | null;
    incentiveSettledAmount: number;
    inviteSettledAmount: number | null;
    incentivePendingAmount: number;
    invitePendingIncome: number | null;
    incentiveStatus: IncentiveStatus;
    updatedAt: string | null;
    createdAt: string | null;
}

export interface AdminIncentivePagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface AdminIncentiveAuthorListResult {
    list: AdminIncentiveAuthorInfo[];
    pagination: AdminIncentivePagination;
}

export interface IncentiveSummary {
    inviteCount: number;
    invitePendingIncome: number;
    inviteSettledAmount: number;
    incentiveStartTime: string;
    incentiveEndTime: string;
}

export interface AdminIncentiveAuthorGamesResult {
    author: AdminIncentiveAuthorInfo;
    incentiveSummary: IncentiveSummary | null;
    list: AdminIncentiveGameRecord[];
    pagination: AdminIncentivePagination;
}

export interface AdminIncentiveAuthorGamesParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
}

export interface AdminUpdateIncentiveAuthorPayload {
    userSegment: UserSegment;
}

export interface AdminUpdateIncentiveGamePayload {
    enabled: boolean;
    incentiveStartTime?: string;
    incentiveEndTime?: string | null;
    incentiveSettledAmount?: number;
    inviteSettledAmount?: number;
}
