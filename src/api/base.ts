// src/api/base.ts
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/useAuthStore';
import { HOST_ADDRESS } from '../config';

const BASE_URL = HOST_ADDRESS + '/api';

export interface ApiConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

// 刷新 token 接口路径
const REFRESH_URL = '/auth/refresh';

/**
 * 判断 accessToken 是否即将过期
 * @param token accessToken
 * @param bufferSeconds 提前刷新时间（秒），默认 120 秒
 */
const isTokenNearExpiry = (token?: string, bufferSeconds = 120): boolean => {
  if (!token) {
    console.log('[Auth] No token found, need refresh.');
    return true; // 没 token 就当作要刷新
  }
  try {
    const decoded = jwtDecode(token) as { exp: number }; // exp 是秒级时间戳
    const now = Date.now() / 1000;
    const timeLeft = decoded.exp - now;
    return timeLeft < bufferSeconds; // 剩余时间小于 bufferSeconds 则需要刷新
  } catch {
    return true; // 解析失败也当作无效
  }
};

// 当前是否已经在刷新 Token（Promise 用于并发请求时共用刷新结果）
let refreshPromise: Promise<string> | null = null;

/**
 * 调用后端刷新 accessToken
 * @returns 新的 accessToken
 */
const refreshAccessToken = async (): Promise<string> => {
  const { user, updateToken, logout, updateUser } = useAuthStore.getState();
  if (!user?.refreshToken) {
    logout();
    throw new Error('No refresh token available');
  }

  try {
    const resp = await axios.post(`${BASE_URL}${REFRESH_URL}`, {
      refreshToken: user.refreshToken,
    });
    const data = resp.data.data;
    if (!data || !data.token || !data.refreshToken) {
      throw new Error('Invalid refresh response data');
    }
    
    // 更新 token 和 refreshToken
    updateToken(data.token, data.refreshToken);

    // 更新用户信息
    if (data.user) {
      updateUser(data.user);
    }

    console.log('[Auth] Token refreshed successfully:', data.token);
    return data.token;
  } catch (err) {
    console.error('[Auth] Failed to refresh token:', err);
    logout();
    throw err;
  }
};


export const createApi = (config?: ApiConfig): AxiosInstance => {
  const instance = axios.create({
    baseURL: config?.baseURL || BASE_URL,
    timeout: config?.timeout || 10000,
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  });

  /**
   * 请求拦截器：
   *  - 检查 token 是否快过期
   *  - 如果快过期则刷新
   *  - 刷新完成后给请求加上最新的 Authorization
   */
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      console.log('[API] 请求拦截器:', { url: config.url, method: config.method });
      let token = useAuthStore.getState().user?.token;

      if (!token) {
        console.log('[API] 没有 token，继续请求（可能是注册/登录请求）');
        delete config.headers.Authorization;
        return config;
      }

      // 如果 token 即将过期，触发刷新
      if (isTokenNearExpiry(token)) {
        if (!refreshPromise) {
          console.log('token即将过期，刷新token');
          // 防止多个请求同时刷新
          refreshPromise = refreshAccessToken()
            .finally(() => {
              refreshPromise = null;
            });
        }
        token = await refreshPromise; // 等待刷新完成
      }

      // 将最新 token 加到请求头
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[Auth] Added Authorization header to request.');
      } else {
        delete config.headers.Authorization; // 没 token 就不发
        console.log('[Auth] No token after refresh, removing Authorization header.');
      }

      return config;
    },
    (error: AxiosError) => {
      console.error('[Auth] Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  /**
   * 响应拦截器：
   *  - 如果返回 403，说明 refreshToken 也过期了，直接退出登录
   */
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 403) {
        console.warn('[Auth] Refresh token expired or invalid, logging out.');
        useAuthStore.getState().logout();
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export const api = createApi();