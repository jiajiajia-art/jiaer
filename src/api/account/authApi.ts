// src/api/auth.ts
import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { AuthResponse, LoginRequest, SignupRequest, User, SendCodeRequest, ResetPasswordRequest } from "./auth.type";

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
    api.post<ApiResponse<null>>('/auth/user/signin'),

  useInviteCode: (data: { inviteCode: string }) =>
    api.post<ApiResponse<null>>('/auth/invite/use-code', data),

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
};