import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
//import { isMiniProgramEnv } from '../utils/miniProgram';

interface AdminRouteProps {
    children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
    const location = useLocation();
    const userRole = useAuthStore((state) => state.user?.user?.role);

    if (userRole !== 'admin') {
        return <Navigate to="/home" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
