import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { isMiniProgramEnv } from '../utils/miniProgram';
import { isOperatorRole } from '../utils/userRoles';

interface OperatorRouteProps {
  children: React.ReactNode;
}

export const OperatorRoute: React.FC<OperatorRouteProps> = ({ children }) => {
  const location = useLocation();
  const role = useAuthStore((state) => state.user?.user?.role);
  const isDesktop = typeof window === 'undefined' ? true : window.innerWidth > 768;

  if (!isOperatorRole(role) || !isDesktop || isMiniProgramEnv()) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
