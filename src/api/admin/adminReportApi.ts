import type { ApiResponse } from '../api.types';
import { api } from '../base';

export type AdminReportStatus = 'pending' | 'rejected' | 'upheld';
export type AdminReportTargetType = 'game' | 'user' | 'post';

export type AdminReportListItem = {
  id: number;
  reporterUserId: string;
  targetType: AdminReportTargetType;
  targetId: string;
  targetOwnerUserId: string;
  reasonCode: string;
  reasonTitle: string;
  detail: string | null;
  targetTitle: string | null;
  /** 举报人当前昵称；空或用户不存在为 null */
  reporterNickname?: string | null;
  reporterUserCode?: string | null;
  /** 账号举报=被举报人当前昵称；游戏举报=创作者当前昵称 */
  targetOwnerNickname?: string | null;
  targetOwnerUserCode?: string | null;
  /** 仅 targetType=game 时返回；作品不存在为 null */
  gameTitle?: string | null;
  evidenceUrls: string[];
  status: AdminReportStatus;
  warned: boolean;
  penaltyLevelApplied: number | null;
  createdAt: string;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

export type AdminReportListData = {
  list: AdminReportListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminPunishmentSnapshot = {
  publishBanUntil?: string | null;
  homepageHidden?: boolean;
  activePenaltyLevel?: number | null;
  observationUntil?: string | null;
};

export type AdminModerationHistoryItem = {
  /** 警告/处罚 → moderation_id；申诉 → appeal_id（均为 16 位字符串；未补数可能为 null） */
  id: string | null;
  recordType: string;
  level?: number | null;
  status?: string | null;
  body?: string | null;
  createdAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AdminReportDetail = AdminReportListItem & {
  handleActions?: string[] | null;
  reviewerUserId?: string | null;
  ownerWarningCount?: number | null;
  ownerPunishment?: AdminPunishmentSnapshot | null;
  ownerModerationHistory?: AdminModerationHistoryItem[];
};

export type AdminReportReviewPayload = {
  decision: 'reject' | 'uphold';
  actions?: string[];
  resetFields?: Array<'avatar' | 'nickname' | 'bio'>;
  reviewNote?: string;
  penaltyLevel?: number | null;
};

export type AdminReportReviewResult = {
  reportId: number;
  status: AdminReportStatus;
  actions: string[];
  warned: boolean;
  penaltyLevelApplied: number | null;
};

export type AdminPenaltyListItem = {
  /** 16 位 moderation_id */
  id: string;
  userId: string;
  recordType: string;
  level: number | null;
  status: string | null;
  notifyBody?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  observationUntil?: string | null;
  createdAt?: string | null;
};

export type AdminPenaltyListData = {
  list: AdminPenaltyListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminReportListParams = {
  status?: AdminReportStatus | '';
  targetType?: AdminReportTargetType | '';
  keyword?: string;
  targetOwnerUserId?: string;
  /** 被举报人 / 创作者当前昵称，模糊匹配 */
  targetOwnerNickname?: string;
  reporterUserId?: string;
  page?: number;
  pageSize?: number;
};

export type AdminModerationDetail = {
  /** 16 位 moderation_id 字符串 */
  id: string;
  userId?: string;
  recordType: string;
  level?: number | null;
  status?: string | null;
  notifyBody?: string | null;
  reportId?: number | null;
  reasonCode?: string | null;
  reasonTitle?: string | null;
  reportDetail?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  observationUntil?: string | null;
  hasAppealed?: boolean;
  canAppeal?: boolean;
  appealId?: string | null;
};

const adminReportApi = {
  listReports: (params: AdminReportListParams) =>
    api.get<ApiResponse<AdminReportListData>>('/admin/reports', { params }),

  getReport: (id: number) =>
    api.get<ApiResponse<AdminReportDetail>>(`/admin/reports/${id}`),

  getModeration: (id: string) =>
    api.get<ApiResponse<AdminModerationDetail>>(`/moderation/${encodeURIComponent(id)}`),

  reviewReport: (id: number, payload: AdminReportReviewPayload) =>
    api.post<ApiResponse<AdminReportReviewResult>>(`/admin/reports/${id}/review`, payload),

  listPenalties: (params?: { page?: number; pageSize?: number; userId?: string }) =>
    api.get<ApiResponse<AdminPenaltyListData>>('/admin/penalties', { params }),

  restoreGame: (fileId: string) =>
    api.post<ApiResponse<{ fileId: string; moderationStatus: string }>>(
      '/admin/moderation/restore-game',
      { fileId },
    ),
};

export default adminReportApi;
