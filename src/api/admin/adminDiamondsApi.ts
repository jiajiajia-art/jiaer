import { api } from '../base';
import type { ApiResponse } from '../api.types';
import type { AdminDiamondChangeType } from '../../utils/adminDiamondAdjustment';
import type { KkValidityType } from '../../utils/adminDiamondAdjustment';

export interface AdminDiamondUser {
  userId: string;
  nickname: string;
  userCode: string;
  phoneNumber: string;
  diamonds: number;
}

export interface AdminDiamondAdjustmentPayload {
  userId: string;
  changeType: AdminDiamondChangeType;
  diamonds: number;
  remark?: string;
  operationId: string;
  validityType?: KkValidityType;
  validDays?: number;
}

export interface AdminDiamondAdjustmentResult {
  user: AdminDiamondUser;
  activity: {
    id: number;
    operationId: string;
    activityType: 'admin_manual_adjust';
    diamonds: number;
    createdAt: string;
  };
  idempotent: boolean;
}

const adminDiamondsApi = {
  lookupUser: (userCode: string) =>
    api.get<ApiResponse<AdminDiamondUser>>('/admin/diamonds/users/lookup', {
      params: { userCode },
    }),
  adjust: (payload: AdminDiamondAdjustmentPayload) =>
    api.post<ApiResponse<AdminDiamondAdjustmentResult>>('/admin/diamonds/manual-adjust', payload),
};

export default adminDiamondsApi;
