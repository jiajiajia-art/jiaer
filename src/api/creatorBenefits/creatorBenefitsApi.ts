import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
  AdminCreatorBenefitUser,
  AdminManagedGameResult,
  CreatorBenefitSummary,
  CreatorBenefitWorksResult,
  SpecialAuthorPayload,
  UpdateAuthorPayload,
} from './creatorBenefits.type';

const creatorBenefitsApi = {
  getSummary: () => api.get<ApiResponse<CreatorBenefitSummary>>('/auth/creator-benefits'),

  getWorks: () => api.get<ApiResponse<CreatorBenefitWorksResult>>('/auth/creator-benefits/works'),

  searchUsers: (keyword: string) => api.get<ApiResponse<{ list: AdminCreatorBenefitUser[] }>>(
    '/admin/creator-benefits/users',
    { params: { keyword } },
  ),

  updateSpecialAuthor: (userId: string, payload: SpecialAuthorPayload) =>
    api.put<ApiResponse<CreatorBenefitSummary>>(
      `/admin/creator-benefits/users/${encodeURIComponent(userId)}/special`,
      payload,
    ),

  updateAuthor: (userId: string, payload: UpdateAuthorPayload) =>
    api.put<ApiResponse<CreatorBenefitSummary>>(
      `/admin/creator-benefits/users/${encodeURIComponent(userId)}/author`,
      payload,
    ),

  listManagedGames: (params: { keyword?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<AdminManagedGameResult>>('/admin/games/manage', { params }),

  takedownGame: (fileId: string, payload: {
    reason: string;
    keepLevelContribution: boolean;
    sendNotification: boolean;
  }) => api.post<ApiResponse<unknown>>(`/admin/games/${encodeURIComponent(fileId)}/takedown`, payload),

  restoreGame: (fileId: string, payload: { reason?: string; sendNotification: boolean }) =>
    api.post<ApiResponse<unknown>>(`/admin/games/${encodeURIComponent(fileId)}/restore`, payload),

  updateLevelContribution: (fileId: string, keepLevelContribution: boolean) =>
    api.patch<ApiResponse<unknown>>(`/admin/games/${encodeURIComponent(fileId)}/level-contribution`, {
      keepLevelContribution,
    }),
};

export default creatorBenefitsApi;
