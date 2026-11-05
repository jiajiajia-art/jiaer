import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
  AdminGamePublishAppealResult,
  GamePublishAppeal,
  GamePublishAppealContext,
  GamePublishAppealStatus,
} from './gamePublishAppeals.type';

const gamePublishAppealsApi = {
  getContext: (fileId: string) => api.get<ApiResponse<GamePublishAppealContext>>(
    `/auth/game-publish-appeals/context/${encodeURIComponent(fileId)}`,
  ),

  submitAppeal: (fileId: string, appealReason: string) => api.post<ApiResponse<GamePublishAppeal>>(
    '/auth/game-publish-appeals',
    { fileId, appealReason },
  ),

  listAdminAppeals: (params: {
    keyword?: string;
    status?: GamePublishAppealStatus | '';
    page?: number;
    pageSize?: number;
  }) => api.get<ApiResponse<AdminGamePublishAppealResult>>('/admin/game-publish-appeals', { params }),

  getPendingCount: () => api.get<ApiResponse<{ pendingCount: number }>>(
    '/admin/game-publish-appeals/pending-count',
  ),

  approveAppeal: (appealId: number, remark: string) => api.post<ApiResponse<GamePublishAppeal>>(
    `/admin/game-publish-appeals/${appealId}/approve`,
    { remark },
  ),

  rejectAppeal: (appealId: number, remark: string) => api.post<ApiResponse<GamePublishAppeal>>(
    `/admin/game-publish-appeals/${appealId}/reject`,
    { remark },
  ),
};

export default gamePublishAppealsApi;

