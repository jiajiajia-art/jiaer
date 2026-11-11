import { api } from '../base';
import type { ApiResponse } from '../api.types';

export type AdminWithdrawItem = {
  id: number;
  withdrawNo: string;
  userId: string;
  nickname: string;
  phone: string;
  amount: number;
  amountCny: number;
  bankCard: string;
  bankBranch: string;
  realName: string;
  idCard: string;
  status: string;
  remark: string;
  createdAt: string;
  processedAt: string | null;
};

export type DiamondTimelineItem = {
  id: number;
  activityType: string;
  diamonds: number;
  description: string;
  businessId: string;
  createdAt: string;
};

export type CreatorVerifyItem = {
  id: number;
  userId: string;
  nickname: string;
  phoneNumber: string;
  userCode: string;
  status: string;
  applyRemark: string;
  adminRemark: string;
  createdAt: string;
  processedAt: string | null;
};

const adminWithdrawApi = {
  list: (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
    api.get<ApiResponse<{ list: AdminWithdrawItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>>(
      '/admin/withdraw/list',
      { params },
    ),

  detail: (id: number) =>
    api.get<ApiResponse<AdminWithdrawItem>>(`/admin/withdraw/${id}`),

  diamondTimeline: (id: number, params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{
      withdraw: AdminWithdrawItem;
      timeline: { list: DiamondTimelineItem[]; pagination: { total: number } };
    }>>(`/admin/withdraw/${id}/diamond-timeline`, { params }),

  approve: (id: number, remark?: string) =>
    api.post<ApiResponse<unknown>>(`/admin/withdraw/${id}/approve`, { remark }),

  reject: (id: number, remark: string) =>
    api.post<ApiResponse<unknown>>(`/admin/withdraw/${id}/reject`, { remark }),

  exportCsv: (params?: { keyword?: string; status?: string }) =>
    api.get<Blob>('/admin/withdraw/export', {
      params,
      responseType: 'blob',
    }),

  listVerify: (params?: { page?: number; pageSize?: number; keyword?: string; status?: string }) =>
    api.get<ApiResponse<{ list: CreatorVerifyItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>>(
      '/admin/creator-verify/list',
      { params },
    ),

  approveVerify: (id: number, adminRemark?: string) =>
    api.post<ApiResponse<unknown>>(`/admin/creator-verify/${id}/approve`, { adminRemark }),

  rejectVerify: (id: number, adminRemark: string) =>
    api.post<ApiResponse<unknown>>(`/admin/creator-verify/${id}/reject`, { adminRemark }),
};

export default adminWithdrawApi;
