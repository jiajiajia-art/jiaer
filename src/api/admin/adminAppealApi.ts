import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
  AdminAppealDetail,
  AdminAppealListData,
  AdminAppealReviewPayload,
  AdminAppealReviewResult,
  AdminAppealStatus,
} from '../appeal/appeal.type';

export type AdminAppealListParams = {
  status?: AdminAppealStatus | '';
  page?: number;
  pageSize?: number;
};

const adminAppealApi = {
  listAppeals: (params?: AdminAppealListParams) =>
    api.get<ApiResponse<AdminAppealListData>>('/admin/appeals', { params }),

  getAppeal: (id: string) =>
    api.get<ApiResponse<AdminAppealDetail>>(`/appeals/${id}`),

  reviewAppeal: (id: string, payload: AdminAppealReviewPayload) =>
    api.post<ApiResponse<AdminAppealReviewResult>>(`/admin/appeals/${id}/review`, payload),
};

export default adminAppealApi;
