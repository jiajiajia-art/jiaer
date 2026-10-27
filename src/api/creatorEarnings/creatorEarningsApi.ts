import { api } from '../base';

export type CreatorEarningPeriod = '7d' | '30d' | '1y' | 'all';
export type CreatorEarningGranularity = 'daily' | 'monthly';
export type CreatorEarningWithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface CreatorEarningSummary {
    pendingGrossYuan: string;
    availableGrossYuan: string;
    frozenGrossYuan: string;
    paidNetYuan: string;
    yesterdayGrossYuan: string;
    monthGrossYuan: string;
    cumulativeGrossYuan: string;
    minimumWithdrawYuan: string;
}

export interface CreatorEarningWithdrawal {
    id: number;
    requestNo: string;
    status: CreatorEarningWithdrawalStatus;
    grossCents: number;
    grossYuan: string;
    incomeTaxCents: number;
    incomeTaxYuan: string;
    payoutCents: number;
    payoutYuan: string;
    bankCardNumber: string;
    bankBranch: string;
    rejectionReason?: string | null;
    approvedAt?: string | null;
    paidAt?: string | null;
    rejectedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreatorEarningTrendPoint {
    bucket: string;
    editorGrossYuan: string;
    customGrossYuan: string;
    sdkGrossYuan: string;
    totalGrossYuan: string;
}

export interface CreatorEarningWithdrawalPreview {
    grossCents: number;
    incomeTaxCents: number;
    payoutCents: number;
    items: Array<{ fileId: string; grossYuan: string }>;
}

export interface CreatorEarningOverview {
    summary: CreatorEarningSummary;
    withdrawalPreview: CreatorEarningWithdrawalPreview | null;
    activeWithdrawal: CreatorEarningWithdrawal | null;
    period: CreatorEarningPeriod;
    granularity: CreatorEarningGranularity;
    trend: CreatorEarningTrendPoint[];
}

export interface CreatorWorkEarningAccount {
    fileId: string;
    creatorUserId: string;
    workType: string;
    cumulativeMicroYuan: string;
    cumulativeYuan: string;
    availableMicroYuan: string;
    availableYuan: string;
    pendingMicroYuan: string;
    pendingYuan: string;
    pendingSettlementDate: string | null;
    frozenMicroYuan: string;
    frozenYuan: string;
    paidMicroYuan: string;
    paidYuan: string;
    lossCarryMicroYuan: string;
    lossCarryYuan: string;
    chargedKkMinorTotal: string;
    chargedKkTotal: string;
    lastSettledAt: string | null;
    updatedAt: string;
}

export interface CreatorEarningLedgerItem {
    id: number;
    fileId: string;
    workType: string;
    eventType: string;
    chargedKkMinor: number;
    qualifiedKkMinor: number;
    qualifiedRevenueYuan: string;
    platformCostMicroYuan: string;
    platformCostYuan: string;
    creatorShareCostMicroYuan: string;
    creatorShareCostYuan: string;
    channelFeeYuan: string;
    orderTaxYuan: string;
    distributableNetYuan: string;
    shareRatioX10000: number;
    creatorEarningYuan: string;
    lossBeforeYuan: string;
    lossAfterYuan: string;
    aiUsage: {
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        imageCount: number;
        imageAspectRatio?: string | null;
    } | null;
    createdAt: string;
}

export interface CreatorEarningLedgerPage {
    items: CreatorEarningLedgerItem[];
    page: number;
    pageSize: number;
    total: number;
}

export interface CreatorEarningExchangeResult {
    id: number;
    exchangeNo: string;
    grossYuan: string;
    creditedKkMinor: number;
    creditedKk: number;
    createdAt: string;
}

interface ApiEnvelope<T> {
    success: boolean;
    data: T;
    message?: string;
}

const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => response.data.data;

const creatorEarningsApi = {
    getOverview: async (params: {
        period?: CreatorEarningPeriod;
        granularity?: CreatorEarningGranularity;
        fileId?: string;
    } = {}) => unwrap(await api.get<ApiEnvelope<CreatorEarningOverview>>('/auth/creator-earnings/overview', { params })),
    listWorks: async (params: { limit?: number; offset?: number } = {}) => (
        unwrap(await api.get<ApiEnvelope<CreatorWorkEarningAccount[]>>('/auth/creator-earnings/works', { params }))
    ),
    listLedger: async (params: { fileId?: string; page?: number; pageSize?: number } = {}) => (
        unwrap(await api.get<ApiEnvelope<CreatorEarningLedgerPage>>('/auth/creator-earnings/ledger', { params }))
    ),
    listWithdrawals: async (params: { limit?: number; offset?: number } = {}) => (
        unwrap(await api.get<ApiEnvelope<CreatorEarningWithdrawal[]>>('/auth/creator-earnings/withdrawals', { params }))
    ),
    createWithdrawal: async (idempotencyKey: string) => (
        unwrap(await api.post<ApiEnvelope<CreatorEarningWithdrawal>>('/auth/creator-earnings/withdraw', { idempotencyKey }))
    ),
    exchangeKk: async (idempotencyKey: string) => (
        unwrap(await api.post<ApiEnvelope<CreatorEarningExchangeResult>>('/auth/creator-earnings/exchange-kk', { idempotencyKey }))
    ),
};

export default creatorEarningsApi;
