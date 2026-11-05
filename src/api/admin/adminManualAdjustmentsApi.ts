import { api } from '../base';
import type { ApiResponse } from '../api.types';

export const ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE = 10;

export type AdminManualAdjustmentCurrency = 'points' | 'diamonds';

export interface AdminManualAdjustmentAccount {
  nickname: string;
  userCode: string;
}

export interface AdminManualAdjustmentHistoryItem {
  id: number;
  operator: AdminManualAdjustmentAccount;
  targetUser: AdminManualAdjustmentAccount;
  changeType: 'increment' | 'decrement';
  amount: number;
  remark: string;
  createdAt: string;
}

export interface AdminManualAdjustmentPage {
  items: AdminManualAdjustmentHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const adminManualAdjustmentsApi = {
  listPoints: (page: number) =>
    api.get<ApiResponse<AdminManualAdjustmentPage>>('/admin/points/manual-adjustments', {
      params: { page, pageSize: ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE },
    }),
  listDiamonds: (page: number) =>
    api.get<ApiResponse<AdminManualAdjustmentPage>>('/admin/diamonds/manual-adjustments', {
      params: { page, pageSize: ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE },
    }),
};

export default adminManualAdjustmentsApi;
