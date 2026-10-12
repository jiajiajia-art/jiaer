// src/api/base.ts
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { HOST_ADDRESS } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { decryptProfilePayload, encryptProfilePayload } from '../utils/profileCrypto';

const BASE_URL = HOST_ADDRESS + '/api';

// 刷新 token 接口路径
const REFRESH_URL = '/auth/refresh';

// Creator Profile API 路径
const CREATOR_PROFILE_API_PATH = '/creator/profile';

// 更宽松的超时（普通上传）
export const UPLOAD_TIMEOUT_MS = 120000;
/** 功能注释：封面 AI 生图含模型画字/垫图，常超过 2 分钟，勿复用上传超时 */
export const COVER_GENERATE_TIMEOUT_MS = 600000;

export interface ApiConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

const normalizeUrlPath = (url?: string): string => {
  if (!url) return '';
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return new URL(url).pathname;
    }
  } catch {
    // Keep the original when URL parsing fails.
  }
  return url.startsWith('/') ? url : `/${url}`;
};

const isCreatorProfilePath = (url?: string): boolean => {
  const path = normalizeUrlPath(url);
  return path === CREATOR_PROFILE_API_PATH || path === `/api${CREATOR_PROFILE_API_PATH}`;
};

const encryptCreatorProfileIfNeeded = async (config: InternalAxiosRequestConfig): Promise<void> => {
  const method = String(config.method || '').toLowerCase();
  if (method !== 'post') return;
  if (!isCreatorProfilePath(config.url)) return;

  const cipher = await encryptProfilePayload(config.data || {});
  config.data = { encrypted: true, data: cipher };
};

/**
 * 判断 accessToken 是否即将过期或已过期
 * @param token accessToken
 * @param bufferSeconds 提前刷新时间（秒），默认 120 秒
 * @returns true 表示 token 已过期或即将过期（剩余时间 < bufferSeconds），需要刷新
 */
const isTokenNearExpiry = (token?: string, bufferSeconds = 120): boolean => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token) as { exp: number };
    const now = Date.now() / 1000;
    const timeLeft = decoded.exp - now;
    // 如果剩余时间小于 bufferSeconds（包括已过期的情况，timeLeft < 0），返回 true
    return timeLeft < bufferSeconds;
  } catch {
    return true; // 解码失败，视为需要刷新
  }
};

let refreshPromise: Promise<string> | null = null;

// 当前是否已经在刷新 Token（Promise 用于并发请求时共用刷新结果）

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

    // 更新 token 和 refreshToken，同时会将 isAuthenticated 设置为 true
    updateToken(data.token, data.refreshToken);

    // 如果后端返回了新的用户信息，也一并更新
    if (data.user) {
      updateUser(data.user);
    }

    console.log('[Auth] Token refreshed successfully, new token stored in localStorage');
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
    timeout: config?.timeout ?? 0,
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  });

  instance.interceptors.request.use(
    /**
     * 请求拦截器：
     *  - 检查 token 是否快过期
     *  - 如果快过期则刷新
     *  - 刷新完成后给请求加上最新的 Authorization
     */
    async (config: InternalAxiosRequestConfig) => {
      const { user } = useAuthStore.getState();
      let token = user?.token;

      if (!token && user?.refreshToken) {
        console.log('[API] Token missing but refreshToken exists, trying to refresh token');
        try {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => {
              refreshPromise = null;
            });
          }
          token = await refreshPromise;
        } catch (error) {
          console.error('[API] Refresh token failed:', error);
          delete config.headers.Authorization;
          await encryptCreatorProfileIfNeeded(config);
          return config;
        }
      }

      if (!token) {
        console.log('[API] No token, continue request (may be login/register).');
        delete config.headers.Authorization;
        await encryptCreatorProfileIfNeeded(config);
        return config;
      }

      if (isTokenNearExpiry(token)) {
        if (!refreshPromise) {
          console.log('[API] Token near expiry, refreshing token.');
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        try {
          token = await refreshPromise;
        } catch (error) {
          console.error('[API] Refresh token failed:', error);
          delete config.headers.Authorization;
          await encryptCreatorProfileIfNeeded(config);
          return config;
        }
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }

      // 功能注释：FormData 必须由浏览器自动带 boundary。
      // 若保留默认 application/json，axios 会把 FormData JSON 化；若手写 multipart/form-data 又缺 boundary，封面等上传都会失败。
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        const headers = config.headers as {
          setContentType?: (value: false | string) => void;
          delete?: (key: string) => void;
        } & Record<string, unknown>;
        if (typeof headers.setContentType === 'function') {
          headers.setContentType(false);
        } else if (typeof headers.delete === 'function') {
          headers.delete('Content-Type');
          headers.delete('content-type');
        } else {
          delete headers['Content-Type'];
          delete headers['content-type'];
        }
      }

      await encryptCreatorProfileIfNeeded(config);
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
    async (response) => {
      const responseData = response?.data as any;
      if (responseData?.encrypted === true && typeof responseData?.data === 'string') {
        const realData = await decryptProfilePayload(responseData.data);
        response.data.data = realData;
      }
      return response;
    },
    (error: AxiosError) => {
      const status = error.response?.status;
      const errorData = error.response?.data as any;

      if (status === 401) {
        useAuthStore.getState().logout();
      } else if (status === 403) {
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
          console.log('[API] Business logic error (403), not logging out:', errorMessage);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export const api = createApi();

const getValidToken = async (): Promise<string | null> => {
  /**
   * 获取当前有效的 token（如果需要则刷新）
   * @returns 有效的 token 或 null
   */
  const { user } = useAuthStore.getState();
  let token = user?.token;

  if (!token && user?.refreshToken) {
    console.log('[Fetch] Token missing but refreshToken exists, trying to refresh token.');
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      token = await refreshPromise;
    } catch (error) {
      console.error('[Fetch] Token refresh failed:', error);
      return null;
    }
  }

  if (!token) {
    console.log('[Fetch] No token found, skipping Authorization header.');
    return null;
  }

  if (isTokenNearExpiry(token)) {
    if (!refreshPromise) {
      console.log('[Fetch] Token near expiry, refreshing token.');
      refreshPromise = refreshAccessToken().finally(() => {
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

export const authFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
  /**
   * Fetch 请求的包装函数，自动处理 token 刷新和携带
   * 支持所有原生 fetch 的功能，包括 SSE 流式请求
   */
  const token = await getValidToken();

  const headers = init?.headers ? new Headers(init.headers) : new Headers();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('[Fetch] Added Authorization header to request.');
  } else {
    headers.delete('Authorization');
    console.log('[Fetch] No token available, skipping Authorization header.');
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  try {
    const response = await fetch(url, requestInit);

    if (response.status === 401) {
      console.warn('[Fetch] Received 401, token invalid, logging out.');
      useAuthStore.getState().logout();
      throw new Error('Authentication failed: Token invalid');
    }

    // 业务层应该自己处理这些错误
    if (response.status === 403) {
      console.log(
        '[Fetch] Received 403, this may be a business logic error (e.g., scene locked, insufficient permissions). Not logging out automatically.'
      );
      // 不自动退出登录，让业务层处理
    }

    return response;
  } catch (error) {
    // Abort 是面板关闭 / 重开请求时的预期取消，不当作失败刷屏
    const name = error && typeof error === 'object' ? String((error as { name?: string }).name || '') : '';
    if (name === 'AbortError' || init?.signal?.aborted) {
      throw error;
    }
    console.error('[Fetch] Request failed:', error);
    throw error;
  }
};
