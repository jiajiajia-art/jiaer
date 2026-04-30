export interface ConversionRequest {
    fileId: string;
    userId: string;
}

export interface ConversionResponse {
    fileId: string;
    conversionCount: number;
}

export interface ViewRequest {
    fileId: string;
    userId: string;
}

export interface ViewResponse {
    fileId: string;
    pvCount: number;
    uvCount: number;
    isNewVisitor: boolean;
    message: string;
}

export interface GameTotalStatsResponse {
    pv: number;
    uv: number;
    likeCount: number;
    Count: number;
    totalAmount: number;
    pendingIncome?: number;
    totalIncentiveAmount?: number;
    inviteCount?: number;
    inviteTotalAmount?: number;
    invitePendingIncome?: number;
    incentiveType?: 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';
}
