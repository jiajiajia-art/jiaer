import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = useAuthStore((state) => state.user?.token);
  const location = useLocation();
  const processedRef = useRef<Set<string>>(new Set());

  // 支持通过 URL 上的 token 进行即时注入，避免在受保护路由上还没处理 token 就被重定向
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const tokenFromUrl = (searchParams.get('token') || '').trim();
      if (!token && tokenFromUrl && !processedRef.current.has(tokenFromUrl)) {
        // 标记已处理，避免反复注入
        processedRef.current.add(tokenFromUrl);
        // 若当前无用户对象，创建一个最小用户壳以便 updateToken 生效
        const current = useAuthStore.getState().user;
        if (!current) {
          useAuthStore.setState({
            user: {
              token: tokenFromUrl,
              refreshToken: '',
              user: {
                id: 0,
                userId: '',
                userCode: '',
                name: '',
                phoneNumber: '',
                role: '',
                createTime: '',
                lastLoginTime: null,
                email: '',
                nickname: '',
                avatarUrl: '',
                points: 0,
                inviteCode: '',
                hasSignedIn: false,
              },
            },
            isAuthenticated: true,
          });
        } else {
          // 已有用户对象则仅更新 token
          useAuthStore.getState().updateToken(tokenFromUrl);
        }
      }
    } catch {
      // 忽略解析错误
    }
  }, [token, location.search]);
  
  // 如果没有 token，但 URL 上带有 token，我们让出一次渲染机会等待 useEffect 注入完成，避免立刻重定向
  const pendingTokenInUrl = (() => {
    try {
      const sp = new URLSearchParams(location.search);
      return !token && !!(sp.get('token') || '').trim();
    } catch { return false; }
  })();

  if (!token && !pendingTokenInUrl) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }
  
  return children ? <>{children}</> : <Outlet />;
};
