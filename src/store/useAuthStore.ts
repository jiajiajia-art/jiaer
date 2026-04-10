import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import type { AuthResponse, User } from '../api/account/auth.type';
import { HOST_ADDRESS } from '../config';

interface DecodedToken {
  exp: number;
  userId?: string;
  role?: string;
}

export interface AuthUser {
  token: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: AuthUser | null;
  email: string;
  isAuthenticated: boolean;
  login: (auth: AuthResponse) => void;
  logout: () => void;
  setEmail: (email: string) => void;
  initialize: () => Promise<void>;
  updateToken: (token: string, refreshToken?: string) => void; // 新增
  updateUser: (user: Partial<User>) => void; // 新增
}

// 用于防止并发刷新的 Promise（与 base.ts 中的 refreshPromise 独立，但逻辑相同）
let initializeRefreshPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      email: '',
      isAuthenticated: false,

      setEmail: (email) => set({ email }),

      initialize: async () => {
        const storedUser = get().user;
        if (!storedUser) {
          return;
        }

        try {
          const currentTime = Date.now() / 1000;
          let tokenValid = false;
          let refreshTokenValid = false;

          // 检查 token 是否有效
          try {
            const decodedToken: DecodedToken = jwtDecode(storedUser.token);
            tokenValid = decodedToken.exp ? decodedToken.exp > currentTime : false;
          } catch (error) {
            console.warn('[Auth] Failed to decode token:', error);
            tokenValid = false;
          }

          // 检查 refreshToken 是否有效
          try {
            const decodedRefreshToken: DecodedToken = jwtDecode(storedUser.refreshToken);
            refreshTokenValid = decodedRefreshToken.exp ? decodedRefreshToken.exp > currentTime : false;
          } catch (error) {
            console.warn('[Auth] Failed to decode refreshToken:', error);
            refreshTokenValid = false;
          }

          // 如果 token 有效，直接认证
          if (tokenValid) {
            set({ isAuthenticated: true });
            return;
          }

          // 如果 token 过期但 refreshToken 还有效，直接刷新 token
          if (refreshTokenValid) {
            // 如果已经在刷新，等待现有的刷新完成
            if (initializeRefreshPromise) {
              console.log('[Auth] Token refresh already in progress, waiting...');
              try {
                await initializeRefreshPromise;
                // 刷新完成后，检查是否成功（通过检查 user 是否存在和 isAuthenticated 状态）
                const updatedUser = get().user;
                if (updatedUser && get().isAuthenticated) {
                  console.log('[Auth] Token refreshed successfully (from concurrent refresh)');
                  return;
                }
              } catch (error) {
                console.error('[Auth] Concurrent refresh failed:', error);
              }
            }

            // 开始刷新
            console.log('[Auth] Token expired but refreshToken is still valid, refreshing token...');
            initializeRefreshPromise = (async () => {
              try {
                const BASE_URL = HOST_ADDRESS + '/api';
                const REFRESH_URL = '/auth/refresh';
                
                const resp = await axios.post(`${BASE_URL}${REFRESH_URL}`, {
                  refreshToken: storedUser.refreshToken,
                });
                
                const data = resp.data.data;
                if (!data || !data.token || !data.refreshToken) {
                  throw new Error('Invalid refresh response data');
                }
                
                // 更新 token 和 refreshToken，同时会将 isAuthenticated 设置为 true
                get().updateToken(data.token, data.refreshToken);
                
                // 如果后端返回了新的用户信息，也一并更新
                if (data.user) {
                  get().updateUser(data.user);
                }
                
                console.log('[Auth] Token refreshed successfully during initialization');
              } catch (error) {
                console.error('[Auth] Failed to refresh token during initialization:', error);
                // 刷新失败，清空用户数据
                set({ user: null, isAuthenticated: false });
                throw error;
              } finally {
                initializeRefreshPromise = null;
              }
            })();

            try {
              await initializeRefreshPromise;
            } catch (error) {
              // 错误已在 Promise 内部处理
            }
            return;
          }

          console.log('[Auth] Both token and refreshToken expired, clearing user data');
          set({ user: null, isAuthenticated: false });
        } catch (error) {
          console.error('[Auth] Failed to initialize auth state:', error);
          set({ user: null, isAuthenticated: false });
        }
      },

      login: (auth: AuthResponse) => {
        set({
          user: {
            token: auth.token,
            refreshToken: auth.refreshToken,
            user: auth.user,
          },
          isAuthenticated: true,
        });
      },

      // 新增：刷新 token
      updateToken: (token, refreshToken) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              token,
              refreshToken: refreshToken ?? state.user.refreshToken,
            },
            isAuthenticated: true,
          };
        });
      },

      // 新增：更新 user 信息
      updateUser: (updatedUser) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              user: {
                ...state.user.user,
                ...updatedUser,
              },
            },
          };
        });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, email: '' });
        // 登出时清除游戏数据，避免数据泄露
        // 动态导入避免循环依赖
        import('./gameStore').then(({ useGameStore }) => {
          useGameStore.getState().clearAll();
        });
        import('./useMessageStore').then(({ useMessageStore }) => {
          useMessageStore.getState().clearUnreadCount();
        });
        sessionStorage.removeItem('checkInModalChecked');
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        email: state.email,
      }),
    }
  )
);


interface AuthModalState {
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (isAuthModalOpen: boolean) => void;
}

export const authModalStore = create<AuthModalState>()(
    (set) => ({
      isAuthModalOpen: false,
      setIsAuthModalOpen: (data: boolean) => set({ isAuthModalOpen: data }),
    }),
);
