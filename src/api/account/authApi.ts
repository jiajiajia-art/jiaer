// src/api/auth.ts
import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { AuthResponse, LoginRequest, SignupRequest, User } from "./auth.type";

export const auth = {
  signup: (data: SignupRequest) =>
    api.post<ApiResponse<User>>('/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),
};