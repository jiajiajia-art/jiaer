import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { isMiniProgramEnv } from '../utils/miniProgram';

interface AdminRouteProps {
    children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const location = useLocation();
    const userRole = useAuthStore((state) => state.user?.user?.role);
    const isDesktop = typeof window === 'undefined' ? true : window.innerWidth > 768;

    // 限制管理面板仅在管理员 PC 端可访问
    if (userRole !== 'admin' || !isDesktop || isMiniProgramEnv()) {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
