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
  /** 禁登录（仅 admin 可设；有则详情展示） */
  loginBanned?: boolean;
  creatorFrozen?: boolean;
  publishNeedReview?: boolean;
};

export type AdminModerationHistoryItem = {
  /** 警告/处罚 → moderation_id；申诉 → appeal_id（均为 16 位字符串；未补数可能为 null） */
  id: string | null;
  recordType: string;
  level?: number | null;
  status?: string | null;
  /** 功能注释：警告是否已计入升档（1/true 则不可再撤警告） */
  consumed?: boolean | number | null;
  body?: string | null;
  createdAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type AdminRevokeModerationPayload = {
  reviewNote?: string;
};

export type AdminRevokeModerationResult = {
  moderationId: string;
  recordType?: string;
  status: 'revoked' | string;
  revokedWarning?: boolean;
  revokedPenalty?: boolean;
  clearedPunishment?: boolean;
  restoredGame?: boolean;
  cancelledAppealId?: string | null;
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

export type AdminPenaltyRecordType = 'warning' | 'penalty';

export type AdminPenaltyListItem = {
  /** 16 位 moderation_id */
  id: string;
  userId: string;
  /** 功能注释：默认列表含 warning + penalty；用此字段区分 */
  recordType?: AdminPenaltyRecordType | string | null;
  level: number | null;
  status: string | null;
  /** 功能注释：警告已用于升档时 true，撤销会 409 warning_already_consumed */
  consumed?: boolean | number | null;
  notifyBody?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  observationUntil?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
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
  /** 功能注释：取自 user_report.review_note；无备注为 null，勿当举报人 detail */
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

export type AdminPublishQueueItem = {
  fileId: string;
  title?: string | null;
  coverUrl?: string | null;
  creatorUserId: string;
  creatorNickname?: string | null;
  creatorUserCode?: string | null;
  authorName?: string | null;
  priceAmount?: number | null;
  shareType?: string | null;
  gameTags?: string | null;
  /** 功能注释：引擎标识，Romance 待审项用于预览表单/游戏 */
  engine?: string | null;
  moderationStatus?: string | null;
  reviewKind?: 'new' | 'update' | string | null;
  publishedVersion?: number;
  submittedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

/** 功能注释：驳回可选勾选原因（可多选），创作者侧可见 */
export const PUBLISH_REJECT_REASON_OPTIONS = [
  { id: 'worldview_incomplete', label: '世界观不完整' },
  { id: 'background_incomplete', label: '背景图不完整' },
  { id: 'cannot_play_fully', label: '无法完整游玩' },
  { id: 'violation_or_other', label: '违规或其他' },
] as const;

export type PublishRejectReasonId = (typeof PUBLISH_REJECT_REASON_OPTIONS)[number]['id'];

export type AdminPublishQueueData = {
  list: AdminPublishQueueItem[];
  total: number;
  page: number;
  pageSize: number;
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

  listPenalties: (params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    /** 功能注释：缺省返回警告+处罚；warning | penalty 可筛 */
    recordType?: AdminPenaltyRecordType | '';
  }) =>
    api.get<ApiResponse<AdminPenaltyListData>>('/admin/penalties', { params }),

  /** 功能注释：撤销警告/当前处罚；operator∪admin；路径为 16 位 moderationId */
  revokeModeration: (moderationId: string, payload?: AdminRevokeModerationPayload) =>
    api.post<ApiResponse<AdminRevokeModerationResult>>(
      `/admin/moderation/${encodeURIComponent(moderationId)}/revoke`,
      payload?.reviewNote?.trim()
        ? { reviewNote: payload.reviewNote.trim() }
        : {},
    ),

  restoreGame: (fileId: string) =>
    api.post<ApiResponse<{ fileId: string; moderationStatus: string }>>(
      '/admin/moderation/restore-game',
      { fileId },
    ),

  listPublishQueue: (params?: { page?: number; pageSize?: number; keyword?: string }) =>
    api.get<ApiResponse<AdminPublishQueueData>>('/admin/moderation/publish-queue', { params }),

  approvePublishQueue: (fileId: string) =>
    api.post<ApiResponse<{ fileId: string; moderationStatus?: string }>>(
      '/admin/moderation/publish-queue/approve',
      { fileId },
    ),

  rejectPublishQueue: (
    fileId: string,
    reviewNote?: string,
    rejectReasons?: PublishRejectReasonId[],
  ) =>
    api.post<ApiResponse<{ fileId: string; moderationStatus?: string }>>(
      '/admin/moderation/publish-queue/reject',
      {
        fileId,
        reviewNote: reviewNote?.trim() || undefined,
        rejectReasons: rejectReasons?.length ? rejectReasons : undefined,
      },
    ),

  /** 功能注释：运营只读拉取 Romance 待审快照正文（非作者 live 草稿） */
  getRomancePendingReviewContent: (fileId: string) =>
    api.get<ApiResponse<{ fileId: string; content: unknown; engine?: string }>>(
      `/admin/moderation/publish-queue/${encodeURIComponent(fileId)}/romance-content`,
    ),

  clearPublishNeedReview: (userId: string) =>
    api.post<ApiResponse<{ userId: string; publishNeedReview?: boolean }>>(
      '/admin/moderation/clear-publish-need-review',
      { userId },
    ),

  /** 功能注释：解禁登录；权限 admin/operator（与申诉通过一致）；施加禁登录仍仅 admin */
  clearLoginBan: (userId: string) =>
    api.post<ApiResponse<{ userId: string; loginBanned?: boolean }>>(
      '/admin/moderation/clear-login-ban',
      { userId },
    ),
};

export default adminReportApi;
