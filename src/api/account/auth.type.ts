// 用户信息
export interface User {
  name: string;
  id: number;
  userId: string;
  userCode: string;
  phoneNumber: string;
  role: string;
  createTime: string;
  lastLoginTime: string | null;
  email: string;
  nickname: string;
  avatarUrl: string;
  points: number;
  inviteCode: string;
  hasSignedIn: boolean;
}

// 注册请求
export interface SignupRequest {
  phoneNumber: string;
  password: string;
  // email: string;
  avatarUrl: string;
  nickname: string;
  // code: string;
}

// 登录请求
export interface LoginRequest {
  phoneNumber: string;
  password: string;
}

// 登录响应
export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresAt: number; // 绝对过期时间戳（秒）
  expiresIn: number; // 相对过期秒数
  user: User;
}

// 发送验证码请求
export interface SendCodeRequest {
  phoneNumber: string;
}

// 重置密码请求
export interface ResetPasswordRequest {
  phoneNumber: string;
  code: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface SettlePointsResponse {
  userId: string;
  settlementAmount: number;
  settlementTime: string;
  lastSettlementTime: string | null;
  gameCount: number;
}