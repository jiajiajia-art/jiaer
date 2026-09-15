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
  authorizeDeveloperCli: (data: DeveloperCliAuthorizeRequest) =>
    openapiApi.post<OpenApiResponse<DeveloperCliAuthorizeResponse>>('/developer/cli/authorize', data),

  createAuthCode: (data: ExternalAuthCodeRequest) =>
    openapiApi.post<OpenApiResponse<ExternalAuthCodeResponse>>('/auth/codes', data),

  denyAuth: (data: ExternalAuthDenyRequest) =>
    openapiApi.post<OpenApiResponse<ExternalAuthDenyResponse>>('/public/auth/deny', data),

  getRechargeSession: (sessionId: string) =>
    openapiApi.get<OpenApiResponse<ExternalRechargeSession>>(`/public/recharge/sessions/${encodeURIComponent(sessionId)}`),

  createRechargePayment: (sessionId: string) =>
    openapiApi.post<OpenApiResponse<ExternalRechargeSession>>(`/public/recharge/sessions/${encodeURIComponent(sessionId)}/payment`),

  getRechargeStatus: (sessionId: string) =>
    openapiApi.get<OpenApiResponse<ExternalRechargeSession>>(`/public/recharge/sessions/${encodeURIComponent(sessionId)}/status`),
};
