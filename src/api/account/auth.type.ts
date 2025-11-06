// 用户信息
export interface User {
  id: number;
  userId: string;
  username: string;
  role: string;
  createTime: string;
  lastLoginTime: string | null;
}

// 注册请求
export interface SignupRequest {
  username: string;
  password: string;
  email: string;
}

// 登录请求
export interface LoginRequest {
  username: string;
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
