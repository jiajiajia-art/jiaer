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
      } else {
        delete config.headers.Authorization; // 没 token 就不发
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
   *  - 如果返回 401，说明 token 无效，需要重新登录
   *  - 如果返回 403 且是认证相关错误（如 token 过期），才退出登录
   *  - 其他 403 可能是业务逻辑错误（如权限不足），不应该退出登录
   */
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const status = error.response?.status;
      const errorData = error.response?.data as any;
      
      // 401: 未授权，token 无效或过期
      if (status === 401) {
        useAuthStore.getState().logout();
      }
      // 403: 需要判断是否是认证错误还是业务错误
      // 只有当错误信息明确表示是认证问题时才退出登录
      else if (status === 403) {
        const errorMessage = errorData?.message || errorData?.error || '';
        const isAuthError = 
          errorMessage.includes('token') || 
          errorMessage.includes('Token') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('Authentication') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('Unauthorized') ||
          errorData?.code === 'TOKEN_EXPIRED' ||
          errorData?.code === 'INVALID_TOKEN';
        
        if (isAuthError) {
          console.warn('[Auth] Authentication error (403), logging out.');
          useAuthStore.getState().logout();
        } else {
          // 业务逻辑错误（如权限不足、场景锁定等），不退出登录
          console.log('[API] Business logic error (403), not logging out:', errorMessage);
        }
      }
      
      return Promise.reject(error);
    }
  );

  return instance;
};

export const api = createApi();

/**
 * 获取当前有效的 token（如果需要则刷新）
 * @returns 有效的 token 或 null
 */
const getValidToken = async (): Promise<string | null> => {
  let token = useAuthStore.getState().user?.token;

  if (!token) {
    console.log('[Fetch] No token found, skipping Authorization header.');
    return null;
  }

  // 如果 token 即将过期，触发刷新
  if (isTokenNearExpiry(token)) {
    if (!refreshPromise) {
      console.log('[Fetch] Token即将过期，刷新token');
      refreshPromise = refreshAccessToken()
        .finally(() => {
          refreshPromise = null;
        });
    }
    try {
      token = await refreshPromise; // 等待刷新完成
    } catch (error) {
      console.error('[Fetch] Token refresh failed:', error);
      return null;
    }
  }

  return token;
};

//  * Fetch 请求的包装函数，自动处理 token 刷新和携带
//  * 支持所有原生 fetch 的功能，包括 SSE 流式请求
export const authFetch = async (
  url: string | URL,
  init?: RequestInit
): Promise<Response> => {
  // 获取有效的 token
  const token = await getValidToken();

  // 准备请求头
  // Headers 构造函数可以接受 Headers 对象、普通对象或数组
  const headers = init?.headers ? new Headers(init.headers) : new Headers();

  // 如果有 token，添加 Authorization header
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('[Fetch] Added Authorization header to request.');
  } else {
    headers.delete('Authorization');
    console.log('[Fetch] No token available, skipping Authorization header.');
  }

  // 合并请求配置
  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  try {
    // 发送请求
    const response = await fetch(url, requestInit);

    // 处理认证错误
    if (response.status === 401) {
      console.warn('[Fetch] Received 401, token invalid, logging out.');
      useAuthStore.getState().logout();
      throw new Error('Authentication failed: Token invalid');
    }
    
    // 处理 403 错误：需要判断是否是认证错误
    // 注意：对于 403，默认不退出登录，因为可能是业务逻辑错误（如场景锁定、权限不足等）
    // 业务层应该自己处理这些错误
    if (response.status === 403) {
      console.log('[Fetch] Received 403, this may be a business logic error (e.g., scene locked, insufficient permissions). Not logging out automatically.');
      // 不自动退出登录，让业务层处理
    }

    return response;
  } catch (error) {
    // 如果是网络错误或其他错误，直接抛出
    console.error('[Fetch] Request failed:', error);
    throw error;
  }
};