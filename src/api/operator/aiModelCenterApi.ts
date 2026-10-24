import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
  AiModelCatalogCard,
  AiModelCapability,
  AiModelPricingStatus,
} from '../../lib/aiModelCatalog';

export interface ImageBillingTier {
  id?: number;
  aspectRatio: string;
  upstreamCostYuanX10000: number;
  userBasePriceKkX10000: number;
}

export interface AiBillingModelRoute {
  id?: number;
  gatewayRoute: string;
  modelId: string;
  inputPriceX10000: number | null;
  outputPriceX10000: number | null;
  cachedInputPriceX10000: number | null;
  textMultiplierX10000: number;
  imageMultiplierX10000: number;
  imageTiers: ImageBillingTier[];
}

export interface AiBillingVersion {
  id: number;
  versionCode: string;
  status: 'draft' | 'published';
  activationMode: 'immediate' | 'scheduled' | null;
  effectiveAt: string | null;
  remark: string | null;
  createdBy: string;
  publishedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  modelRoutes: AiBillingModelRoute[];
}

export interface AiBillingUsageRow {
  fileId: string | null;
  platformSource: string;
  gatewayRoute: string;
  modelId: string;
  status: string;
  currencyType: 'points' | 'kk';
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  platformCostMicroYuan: number;
  billedUnits: number;
}

export interface AiBillingUsageOverview {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  incompleteCalls: number;
  cancelledCalls: number;
  startedCalls: number;
  platformCostMicroYuan: number;
  unbilledPlatformCostMicroYuan: number;
  billedPoints: number;
  billedKkMinor: number;
}

export interface AiBillingUsageTrendRow {
  date: string;
  callCount: number;
  platformCostMicroYuan: number;
}

export interface AiBillingModelRankingRow {
  platformSource: string;
  gatewayRoute: string;
  modelId: string;
  callCount: number;
  platformCostMicroYuan: number;
}

export interface AiBillingUsageSummary {
  overview: AiBillingUsageOverview;
  trend: AiBillingUsageTrendRow[];
  modelRanking: AiBillingModelRankingRow[];
  items: AiBillingUsageRow[];
}

export interface AiBillingUsageAttempt {
  id: string;
  requestId: string;
  sessionId: string | null;
  userId: string | null;
  userNickname: string | null;
  userCode: string | null;
  fileId: string | null;
  gameTitle: string | null;
  platformSource: string;
  attemptNo: number;
  status: string;
  gatewayRoute: string;
  modelId: string;
  billingVersionId: number;
  billingModelRateId: number;
  inputPriceX10000: number | null;
  outputPriceX10000: number | null;
  cachedInputPriceX10000: number | null;
  imageUpstreamCostYuanX10000: number | null;
  imageUserBasePriceKkX10000: number | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  imageCount: number;
  imageAspectRatio: string | null;
  platformCostMicroYuan: number;
  currencyType: 'points' | 'kk';
  userChargeMicroUnits: number;
  settlementStatus: string;
  allocatedUnits: number;
  billedToUser: boolean;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface AiBillingUsagePagination {
  page: number;
  pageSize: 20 | 50 | 100;
  total: number;
  totalPages: number;
}

export interface AiBillingUsageAttemptsPage {
  items: AiBillingUsageAttempt[];
  pagination: AiBillingUsagePagination;
}

export type AiBillingUsageFilters = {
  from?: string;
  to?: string;
  fileId?: string;
  modelId?: string;
  status?: string;
  userKeyword?: string;
  gameKeyword?: string;
  billedToUser?: 'true' | 'false';
  currencyType?: 'kk' | 'points';
};

export interface AiBillingModelCatalogRow {
  id: number;
  capability: AiModelCapability;
  sourceGatewayKey: string;
  sourceGatewayLabel: string;
  sourceBaseUrl: string;
  modelId: string;
  displayName: string;
  sourceKind: 'preset' | 'fetched';
  selectable: boolean;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  pricingStatus: AiModelPricingStatus;
  activePricingVersionId: number | null;
  scheduledPricingVersionId: number | null;
  draftPricingVersionId: number | null;
}

export interface AiModelPricingVersion {
  id: number;
  versionCode: string;
  status: 'draft' | 'published';
  effectiveAt: string | null;
  remark: string | null;
  createdBy: string;
  publishedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  modelCatalogId: number;
  rate: AiBillingModelRoute & { textUserBasePricePer1kX10000: number };
}

export interface AiModelPricingLifecycle {
  catalog: Omit<AiModelCatalogCard, 'active' | 'pricingStatus' | 'activePricingVersionId' | 'scheduledPricingVersionId' | 'draftPricingVersionId'>;
  draft: AiModelPricingVersion | null;
  scheduled: AiModelPricingVersion | null;
  active: AiModelPricingVersion | null;
  history: AiModelPricingVersion[];
}

export type ModelPricingDraftPayload = {
  text?: {
    inputPriceX10000: number;
    outputPriceX10000: number;
    cachedInputPriceX10000: number;
    multiplierX10000: number;
  };
  image?: {
    multiplierX10000: number;
    tiers: ImageBillingTier[];
  };
  remark?: string;
};

const root = '/operator/ai-model-center';

const aiModelCenterApi = {
  listModels: () => api.get<ApiResponse<{ items: AiBillingModelCatalogRow[] }>>(`${root}/models`),
  getModelPricing: (catalogId: number) =>
    api.get<ApiResponse<AiModelPricingLifecycle>>(`${root}/models/${catalogId}/pricing`),
  saveModelPricingDraft: (catalogId: number, payload: ModelPricingDraftPayload) =>
    api.put<ApiResponse<AiModelPricingVersion>>(`${root}/models/${catalogId}/pricing/draft`, payload),
  publishModelPricing: (
    catalogId: number,
    payload: { effectiveAt: string | null; replaceScheduled: boolean },
  ) => api.post<ApiResponse<AiModelPricingVersion>>(`${root}/models/${catalogId}/pricing/publish`, payload),
  listVersions: () => api.get<ApiResponse<{ items: AiBillingVersion[]; total: number }>>(`${root}/versions`),
  createDraft: (payload: { versionCode: string; remark?: string; modelRoutes: AiBillingModelRoute[] }) =>
    api.post<ApiResponse<AiBillingVersion>>(`${root}/versions`, payload),
  publish: (id: number, effectiveAt?: string | null) =>
    api.post<ApiResponse<AiBillingVersion>>(`${root}/versions/${id}/publish`, { effectiveAt: effectiveAt || null }),
  listUsage: (params: AiBillingUsageFilters) =>
    api.get<ApiResponse<AiBillingUsageSummary>>(`${root}/usage`, { params }),
  listUsageAttempts: (
    params: AiBillingUsageFilters & { page: number; pageSize: 20 | 50 | 100 },
  ) => api.get<ApiResponse<AiBillingUsageAttemptsPage>>(`${root}/usage/attempts`, { params }),
};

export default aiModelCenterApi;
