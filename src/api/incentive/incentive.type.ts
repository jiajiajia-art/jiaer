export type AdminIncentiveLookupMode = 'userCode' | 'phoneNumber';

export interface AdminIncentiveAuthorInfo {
    userId: string;
    nickname: string;
    userCode: string;
    phoneNumber: string;
    role: string;
    userSegment: 'normal' | 'incentive' | string;
    incentiveEnabled: boolean;
}

export interface AdminIncentiveAuthorListParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
    enabled?: boolean;
}

export interface AdminIncentiveGameRecord {
    fileId: string;
    creatorUserId: string;
    title: string;
    subtitle: string;
    isPublic: number;
    incentiveStartTime: string | null;
    incentiveEndTime: string | null;
    incentiveSettledAmount: number;
    incentiveStatus: 'none' | 'incentive' | 'finished' | string;
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

export interface AdminIncentiveAuthorGamesResult {
    author: AdminIncentiveAuthorInfo;
    list: AdminIncentiveGameRecord[];
    pagination: AdminIncentivePagination;
}

export interface AdminIncentiveAuthorGamesParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
}

export interface AdminUpdateIncentiveAuthorPayload {
    enabled: boolean;
}

export interface AdminUpdateIncentiveGamePayload {
    enabled: boolean;
    incentiveStartTime?: string;
    incentiveEndTime?: string | null;
    incentiveSettledAmount?: number;
}
