// src/api/auth.ts
import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type {
  AuthResponse,
  BindAccountRequest,
  CheckInResponse,
  LoginRequest,
  MembershipSignInStatus,
  ResetPasswordRequest,
  SendCodeRequest,
  SettlePointsResponse,
  SignupRequest,
  SubscriptionRedeemResult,
  InviteStats,
  InviteClaimResult,
  User,
} from "./auth.type";

export const auth = {
  signup: (data: SignupRequest) =>
    api.post<ApiResponse<User>>('/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),

  sendResetCode: (data: SendCodeRequest) =>
    api.post<ApiResponse<{ data: string }>>('/auth/code/send', data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<ApiResponse<null>>('/auth/code/verify', data),

  getUserInfo: () =>
    api.get<ApiResponse<User>>('/auth/user/info'),

  updateUserInfo: (newUserName: string) =>
    api.post<ApiResponse<User>>('/auth/update/username', { newUserName: newUserName }),

  checkIn: () =>
    api.post<ApiResponse<CheckInResponse | null>>('/auth/user/signin'),

  getSignInStatus: () =>
    api.get<ApiResponse<MembershipSignInStatus>>('/auth/user/signin-status'),

  useInviteCode: (data: { inviteCode: string }) =>
    api.post<ApiResponse<null>>('/auth/invite/use-code', data),

  getInviteStats: () =>
    api.get<ApiResponse<InviteStats>>('/auth/invite/stats'),

  claimInviteReward: (data: { threshold: number }) =>
    api.post<ApiResponse<InviteClaimResult>>('/auth/invite/claim', data),

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

  settlePoints: () =>
    api.post<ApiResponse<SettlePointsResponse>>('/auth/games/points/settle'),

  redeemSubscriptionKey: (data: { redeemKey: string }) =>
    api.post<ApiResponse<SubscriptionRedeemResult>>('/subscriptions/redeem', data),
};
