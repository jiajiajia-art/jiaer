import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { isMiniProgramEnv } from '../utils/miniProgram';
import { isOperatorRole } from '../utils/userRoles';

interface OperatorRouteProps {
  children: React.ReactNode;
}

/**
 * 功能注释：个人中心手机端已放「运营中心」入口，这里不能再按桌面宽度拦截，
 * 否则会 navigate('/operator') 后立刻被踢回 /home，表现为「点了没反应」。
 */
export const OperatorRoute: React.FC<OperatorRouteProps> = ({ children }) => {
  const location = useLocation();
  const role = useAuthStore((state) => state.user?.user?.role);

  if (!isOperatorRole(role) || isMiniProgramEnv()) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
