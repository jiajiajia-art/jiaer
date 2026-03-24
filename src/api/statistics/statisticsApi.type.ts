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
    isIncentive: boolean;
    /** 待结算收益（仅激励作者返回） */
    pendingIncome?: number;
    /** 激励总收益（服务端新增字段，用于“结算总收益（激励）”） */
    totalIncentiveAmount?: number;
}
