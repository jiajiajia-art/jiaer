import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { isCreatorRole } from '../utils/userRoles';

interface CreatorRouteProps {
  children: React.ReactNode;
}

export const CreatorRoute: React.FC<CreatorRouteProps> = ({ children }) => {
  const location = useLocation();
  const role = useAuthStore((state) => state.user?.user?.role);

  if (!isCreatorRole(role)) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
