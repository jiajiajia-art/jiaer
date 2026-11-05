import { api } from '../base';
import type { ApiResponse } from '../api.types';

export type CreatorEarningWithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface CreatorEarningOperatorWithdrawal {
  id: number;
  requestNo: string;
  creatorUserId: string;
  creatorUserCode?: string | null;
  creatorNickname?: string | null;
  phoneNumber: string;
  realName: string;
  idCard: string;
  status: CreatorEarningWithdrawalStatus;
  grossCents: number;
  grossYuan: string;
  payoutCents: number;
  payoutYuan: string;
  incomeTaxCents: number;
  incomeTaxYuan: string;
  bankCardNumber: string;
  bankBranch: string;
  rejectionReason?: string | null;
  remark?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorEarningWithdrawalItem {
  fileId: string;
  gameType?: string | null;
  gameTitle?: string | null;
  grossMicroYuan: string;
  grossYuan: string;
}

export interface CreatorEarningOperatorWithdrawalDetail extends CreatorEarningOperatorWithdrawal {
  items: CreatorEarningWithdrawalItem[];
}

export interface CreatorEarningOperatorWithdrawalList {
  success: boolean;
  data: CreatorEarningOperatorWithdrawal[];
}

const root = '/operator/creator-earnings/withdrawals';

const operatorCreatorEarningsApi = {
  listWithdrawals: (params: {
    status?: CreatorEarningWithdrawalStatus;
    limit?: number;
    offset?: number;
  } = {}) => api.get<ApiResponse<CreatorEarningOperatorWithdrawal[]>>(root, { params }),
  getWithdrawal: (id: number | string) =>
    api.get<ApiResponse<CreatorEarningOperatorWithdrawalDetail>>(`${root}/${encodeURIComponent(id)}`),
  approveWithdrawal: (id: number | string, remark: string) =>
    api.post<ApiResponse<unknown>>(`${root}/${encodeURIComponent(id)}/approve`, { remark }),
  rejectWithdrawal: (id: number | string, reason: string) =>
    api.post<ApiResponse<unknown>>(`${root}/${encodeURIComponent(id)}/reject`, { reason }),
  markWithdrawalPaid: (id: number | string, remark: string) =>
    api.post<ApiResponse<unknown>>(`${root}/${encodeURIComponent(id)}/paid`, { remark }),
};

export default operatorCreatorEarningsApi;
