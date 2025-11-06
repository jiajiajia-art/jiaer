import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';
import type { AuthResponse, User } from '../api/account/auth.type';

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
  initialize: () => void;
  updateToken: (token: string, refreshToken?: string) => void; // 新增
  updateUser: (user: Partial<User>) => void; // 新增
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      email: '',
      isAuthenticated: false,

      setEmail: (email) => set({ email }),

      initialize: () => {
        const storedUser = get().user;
        if (!storedUser) {
          return;
        }

        try {
          const decodedToken: DecodedToken = jwtDecode(storedUser.token);
          const currentTime = Date.now() / 1000;

          if (decodedToken.exp && decodedToken.exp > currentTime) {
            set({ isAuthenticated: true });
          } else {
            set({ user: null, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Failed to decode token:', error);
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
