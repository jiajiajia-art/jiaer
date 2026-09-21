import { HOST_ADDRESS } from '../config';
import { createApi } from './base';

export interface OpenApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface ExternalAuthCodeRequest {
  appId: string;
  redirectUri: string;
  externalUserId?: string;
  state?: string;
}

export interface ExternalAuthCodeResponse {
  appId: string;
  code: string;
  redirectUri: string;
  redirectUrl: string;
  externalUserId: string | null;
  expiresAt: string;
}

export interface ExternalAuthDenyRequest {
  appId: string;
  redirectUri: string;
  state?: string;
}

export interface ExternalAuthDenyResponse {
  appId: string;
  redirectUri: string;
  redirectUrl: string;
}

export interface DeveloperCliAuthorizeRequest {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}

export interface DeveloperCliAuthorizeResponse {
  code: string;
  redirectUri: string;
  redirectUrl: string;
  expiresAt: string;
}

export interface ExternalDeveloperApp {
  appId: string;
  ownerUserId?: string;
  name: string;
  status?: string;
  allowedOrigins?: string[];
  redirectUris?: string[];
  webhookUrl?: string | null;
  aiAllowedModels?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDeveloperAppRequest {
  name: string;
  allowedOrigins?: string[];
  redirectUris?: string[];
  webhookUrl?: string;
  aiAllowedModels?: string[];
}

export interface CreateDeveloperAppResponse {
  app: ExternalDeveloperApp;
  appSecret: string;
  webhookSecret?: string;
}

export interface ExternalDeveloperAppUserLink {
  appId: string;
  funloomUserId: string;
  externalUserId: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  funloomUser: {
    userId: string;
    userCode?: string | null;
    nickname?: string | null;
    maskedPhone?: string | null;
  };
}

export interface ExternalDeveloperFunloomUser {
  userId: string;
  userCode?: string | null;
  nickname?: string | null;
  maskedPhone?: string | null;
}

export interface DeveloperAppUserLinksResponse {
  app: ExternalDeveloperApp;
  links: ExternalDeveloperAppUserLink[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeveloperAppListParams {
  limit?: number;
  offset?: number;
}

export interface ExternalDeveloperAppRechargeSummary {
  totalAmount: number;
  orderCount: number;
  series: Array<{
    date: string;
    totalAmount: number;
    orderCount: number;
  }>;
}

export interface ExternalDeveloperAppRechargeOrder {
  sessionId: string;
  appId: string;
  funloomUserId: string;
  externalUserId?: string | null;
  planId?: string | null;
  outTradeNo?: string | null;
  status: string;
  paymentStatus?: string | null;
  totalAmount?: number | null;
  metadata?: Record<string, unknown> | null;
  returnUrl?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  paymentUpdatedAt?: string | null;
  funloomUser: ExternalDeveloperFunloomUser;
}

export interface DeveloperAppRechargeOrdersResponse {
  app: ExternalDeveloperApp;
  orders: ExternalDeveloperAppRechargeOrder[];
  summary?: ExternalDeveloperAppRechargeSummary;
  total: number;
  limit: number;
  offset: number;
}

export interface ExternalDeveloperAppDiamondLedgerSummary {
  totalDiamonds: number;
  entryCount: number;
  series: Array<{
    date: string;
    totalDiamonds: number;
    entryCount: number;
  }>;
}

export interface ExternalDeveloperAppDiamondLedgerEntry {
  orderNo: string;
  appId: string;
  funloomUserId: string;
  externalUserId?: string | null;
  orderType: string;
  amount: number;
  diamondDelta?: number | null;
  reason: string;
  idempotencyKey: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  diamondActivityCreatedAt?: string | null;
  funloomUser: ExternalDeveloperFunloomUser;
}

export interface DeveloperAppDiamondLedgerResponse {
  app: ExternalDeveloperApp;
  entries: ExternalDeveloperAppDiamondLedgerEntry[];
  summary?: ExternalDeveloperAppDiamondLedgerSummary;
  total: number;
  limit: number;
  offset: number;
}

export interface ExternalDeveloperAppAiTrace {
  traceId: string;
  appId: string;
  funloomUserId: string;
  externalUserId?: string | null;
  walletOrderNo?: string | null;
  sceneCode: string;
  model?: string | null;
  stream: boolean;
  status: string;
  responsePreview?: string | null;
  usage?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  funloomUser: ExternalDeveloperFunloomUser;
}

export interface DeveloperAppAiTracesResponse {
  app: ExternalDeveloperApp;
  traces: ExternalDeveloperAppAiTrace[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExternalDeveloperAppOwner {
  userId: string;
  userCode?: string | null;
  nickname?: string | null;
}

export interface TransferDeveloperAppOwnerResponse {
  app: ExternalDeveloperApp;
  previousOwner: ExternalDeveloperAppOwner;
  nextOwner: ExternalDeveloperAppOwner;
  transferredBy: ExternalDeveloperAppOwner;
}

export interface ExternalRechargePlan {
  id: string;
  price: number;
  diamonds: number;
  label: string;
  currency: string;
}

export interface ExternalRechargePayment {
  outTradeNo: string;
  status: string | null;
  qrDataUrl: string | null;
  paidAt: string | null;
  updatedAt: string | null;
}

export interface ExternalRechargeSession {
  sessionId: string;
  appId: string;
  appName: string;
  plan: ExternalRechargePlan | null;
  plans?: ExternalRechargePlan[];
  status: string;
  returnUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  payment: ExternalRechargePayment | null;
  balance?: number;
}

const openapiApi = createApi({
  baseURL: `${HOST_ADDRESS}/openapi/v1`,
});

export const externalSdkApi = {
  listDeveloperApps: () =>
    openapiApi.get<OpenApiResponse<{ apps: ExternalDeveloperApp[] }>>('/developer/apps'),

  createDeveloperApp: (data: CreateDeveloperAppRequest) =>
    openapiApi.post<OpenApiResponse<CreateDeveloperAppResponse>>('/developer/apps', data),

  listDeveloperAppUserLinks: (appId: string) =>
    openapiApi.get<OpenApiResponse<DeveloperAppUserLinksResponse>>(`/developer/apps/${encodeURIComponent(appId)}/user-links`),

  listDeveloperAppRechargeOrders: (appId: string, params?: DeveloperAppListParams) =>
    openapiApi.get<OpenApiResponse<DeveloperAppRechargeOrdersResponse>>(
      `/developer/apps/${encodeURIComponent(appId)}/recharge-orders`,
      { params },
    ),

  listDeveloperAppDiamondLedger: (appId: string, params?: DeveloperAppListParams) =>
    openapiApi.get<OpenApiResponse<DeveloperAppDiamondLedgerResponse>>(
      `/developer/apps/${encodeURIComponent(appId)}/diamond-ledger`,
      { params },
    ),

  listDeveloperAppAiTraces: (appId: string) =>
    openapiApi.get<OpenApiResponse<DeveloperAppAiTracesResponse>>(`/developer/apps/${encodeURIComponent(appId)}/ai-traces`),

  transferDeveloperAppOwner: (appId: string, data: { targetUserCode: string }) =>
    openapiApi.post<OpenApiResponse<TransferDeveloperAppOwnerResponse>>(
      `/developer/apps/${encodeURIComponent(appId)}/transfer-owner`,
      data,
    ),

  authorizeDeveloperCli: (data: DeveloperCliAuthorizeRequest) =>
    openapiApi.post<OpenApiResponse<DeveloperCliAuthorizeResponse>>('/developer/cli/authorize', data),

  createAuthCode: (data: ExternalAuthCodeRequest) =>
    openapiApi.post<OpenApiResponse<ExternalAuthCodeResponse>>('/auth/codes', data),

  denyAuth: (data: ExternalAuthDenyRequest) =>
    openapiApi.post<OpenApiResponse<ExternalAuthDenyResponse>>('/public/auth/deny', data),

  getRechargeSession: (sessionId: string) =>
    openapiApi.get<OpenApiResponse<ExternalRechargeSession>>(`/public/recharge/sessions/${encodeURIComponent(sessionId)}`),

  createRechargePayment: (sessionId: string, data?: { planId?: string }) =>
    openapiApi.post<OpenApiResponse<ExternalRechargeSession>>(`/public/recharge/sessions/${encodeURIComponent(sessionId)}/payment`, data),

  getRechargeStatus: (sessionId: string) =>
    openapiApi.get<OpenApiResponse<ExternalRechargeSession>>(`/public/recharge/sessions/${encodeURIComponent(sessionId)}/status`),
};
