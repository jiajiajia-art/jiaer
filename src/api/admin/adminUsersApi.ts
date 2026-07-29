import { api } from '../base';
import type { ApiResponse } from '../api.types';

export interface AdminUserItem {
  userId: string;
  userCode: string;
  nickname: string;
  phoneNumber: string;
  role: string;
  userSegment: string;
  avatarUrl: string;
  createTime: string;
  lastLoginTime: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  assignableRoles: string[];
}

const adminUsersApi = {
  listUsers: (params?: { page?: number; pageSize?: number; keyword?: string; role?: string }) =>
    api.get<ApiResponse<AdminUsersResponse>>('/admin/users', { params }),
  updateUserRole: (userId: string, role: string) =>
    api.put<ApiResponse<{ userId: string; role: string }>>(`/admin/users/${userId}/role`, { role }),
};

export default adminUsersApi;
