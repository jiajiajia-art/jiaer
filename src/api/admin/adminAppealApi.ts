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

  getAppeal: (id: number) =>
    api.get<ApiResponse<AdminAppealDetail>>(`/admin/appeals/${id}`),

  reviewAppeal: (id: number, payload: AdminAppealReviewPayload) =>
    api.post<ApiResponse<AdminAppealReviewResult>>(`/admin/appeals/${id}/review`, payload),
};

export default adminAppealApi;
