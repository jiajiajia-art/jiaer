// src/api/auth.ts
import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { Currency } from "../common/currency";
import type {
  AuthResponse,
  BindAccountRequest,
  CheckInResponse,
  ExchangeDiamondsRequest,
  ExchangeDiamondsResponse,
  GetPointsActivitiesParams,
  LoginRequest,
  MembershipSignInStatus,
  PointsActivitiesResponse,
  ResetPasswordRequest,
  SaveProfilePreferencesRequest,
  SaveProfilePreferencesResponse,
  SignInMakeupResponse,
  SendCodeRequest,
  SettlePointsResponse,
  SignupRequest,
  SubscriptionRedeemResult,
  InviteCodeUseResult,
  User,
} from "./auth.type";
import {
  REGISTRATION_CODE_REQUEST_TIMEOUT_MS,
  REGISTRATION_SUBMIT_TIMEOUT_MS,
} from '../../lib/registrationRequest';

export const auth = {
  signup: (data: SignupRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data, {
      timeout: REGISTRATION_SUBMIT_TIMEOUT_MS,
    }),

  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),

  sendResetCode: (data: SendCodeRequest) =>
    api.post<ApiResponse<{ data: string }>>('/auth/code/send', data),

  sendCode: (data: SendCodeRequest) =>
    api.post<ApiResponse<null>>('/auth/code/send', data, {
      timeout: REGISTRATION_CODE_REQUEST_TIMEOUT_MS,
    }),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<ApiResponse<null>>('/auth/code/verify', data),

  getUserInfo: () =>
    api.get<ApiResponse<User>>('/auth/user/info'),

  updateUserInfo: (newUserName: string) =>
    api.post<ApiResponse<User>>('/auth/update/username', { newUserName: newUserName }),

  saveProfilePreferences: (data: SaveProfilePreferencesRequest) =>
    api.post<ApiResponse<SaveProfilePreferencesResponse>>('/auth/user/preferences', data),

  checkIn: () =>
    api.post<ApiResponse<CheckInResponse | null>>('/auth/user/signin'),

  makeUpSignIn: (date: string) =>
    api.post<ApiResponse<SignInMakeupResponse | null>>('/auth/user/signin/makeup', { date }),

  getSignInStatus: () =>
    api.get<ApiResponse<MembershipSignInStatus>>('/auth/user/signin-status'),

  getPointsActivities: (params: GetPointsActivitiesParams) => {
    const mergedParams = { ...params, currency: params.currency || 'points' };
    return api.get<ApiResponse<PointsActivitiesResponse>>('/auth/user/points/activities', { params: mergedParams });
  },

  useInviteCode: (data: { inviteCode: string }) =>
    api.post<ApiResponse<InviteCodeUseResult>>('/auth/invite/use-code', data),

  updateUserAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<ApiResponse<{
      avatarUrl: string;
    }>>('/auth/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  bindAccount: (data: BindAccountRequest) =>
    api.post<ApiResponse<User>>('/auth/bind/account', data),

  settlePoints: (type?: Currency) =>
    api.post<ApiResponse<SettlePointsResponse>>('/auth/games/points/settle', type ? { type } : {}),

  redeemSubscriptionKey: (data: { redeemKey: string }) =>
    api.post<ApiResponse<SubscriptionRedeemResult>>('/subscriptions/redeem', data),

  googleLogin: (data: { idToken: string }) =>
    api.post<ApiResponse<AuthResponse>>('/auth/google/login', data),

  exchangeDiamonds: (data: ExchangeDiamondsRequest) =>
    api.post<ApiResponse<ExchangeDiamondsResponse>>('/auth/currency/exchange', data),

  /** 功能注释：用户自助注销账号（不可逆；成功后前端应登出） */
  deleteAccount: () =>
    api.post<ApiResponse<{ alreadyDeleted?: boolean; deletedAt?: string | null }>>(
      '/auth/user/delete-account',
    ),
};
