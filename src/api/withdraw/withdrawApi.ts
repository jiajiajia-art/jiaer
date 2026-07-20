import { api } from '../base';
import type { ApiResponse } from '../api.types';

export type WithdrawEligibility = {
  canWithdraw: boolean;
  role: string;
  profileComplete: boolean;
  missingProfileFields: string[];
  balance: number;
  maxWithdrawable: number;
  diamondUnit: number;
  rateLabel: string;
  pendingWithdraw: {
    id: number;
    withdrawNo: string;
    amount: number;
    amountCny: number;
    status: string;
    createdAt: string;
    message: string;
  } | null;
  pendingMessage: string;
};

export type WithdrawRecord = {
  id: number;
  withdrawNo: string;
  amount: number;
  amountCny: number;
  status: string;
  remark: string;
  createdAt: string;
  processedAt: string | null;
};

export type CreatorVerifyStatus = {
  role: string;
  isVerified: boolean;
  latest: {
    id: number;
    status: string;
    applyRemark: string;
    adminRemark: string;
    createdAt: string;
    processedAt: string | null;
  } | null;
};

const withdrawApi = {
  getEligibility: () =>
    api.get<ApiResponse<WithdrawEligibility>>('/auth/withdraw/eligibility'),

  create: (amount: number) =>
    api.post<ApiResponse<{
      withdrawNo: string;
      amount: number;
      amountCny: number;
      status: string;
      message: string;
    }>>('/auth/withdraw/create', { amount, currency: 'diamonds' }),

  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{
      list: WithdrawRecord[];
      pagination: { page: number; pageSize: number; total: number; totalPages?: number };
    }>>(
      '/auth/withdraw/list',
      { params },
    ),

  getVerifyStatus: () =>
    api.get<ApiResponse<CreatorVerifyStatus>>('/auth/creator-verify/status'),

  applyVerify: (applyRemark?: string) =>
    api.post<ApiResponse<{ id: number; status: string }>>('/auth/creator-verify/apply', { applyRemark }),
};

export default withdrawApi;
