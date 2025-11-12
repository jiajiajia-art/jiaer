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
};