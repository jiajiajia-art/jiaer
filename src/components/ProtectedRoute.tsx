import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = useAuthStore((state) => state.user?.token);
  const location = useLocation();
  
  if (!token) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }
  
  return children ? <>{children}</> : <Outlet />;
};