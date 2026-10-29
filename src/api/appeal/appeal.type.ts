/** 申诉 P1 — 对齐 API-申诉.md / §15 16 位 moderation_id */

export type AppealRecordType = 'warning' | 'penalty' | 'appeal';
export type AppealStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | string;

/** 功能注释：对外 16 位数字字符串（moderation_id / appeal_id），勿 Number() */
export type ExternalModerationId = string;

export type AppealEligibleItem = {
  /** 16 位 moderation_id */
  id: ExternalModerationId;
  recordType: 'warning' | 'penalty' | string;
  level?: number | null;
  status?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  notifyBody?: string | null;
  createdAt?: string | null;
  canAppeal: boolean;
  appealDeadline?: string | null;
};

export type AppealEligibleData = {
  list: AppealEligibleItem[];
};

export type AppealUploadEvidenceData = {
  key: string;
  url?: string;
};

/**
 * 申诉原因字典 targetType（与举报 game/user/post 分套，勿混用）。
 * 列表：GET /report/reasons?targetType=…
 * 提交：同名字段 reasonTargetType（或 targetType）
 */
export type AppealReasonTargetType = 'appeal_user' | 'appeal_game' | 'appeal_post';

/** 功能注释：由 moderation/eligible 的 sourceType 映射到申诉原因套 */
export const resolveAppealReasonTargetType = (
  sourceType?: string | null,
): AppealReasonTargetType => {
  const normalized = String(sourceType || '').trim().toLowerCase();
  if (normalized === 'game') return 'appeal_game';
  if (normalized === 'post') return 'appeal_post';
  return 'appeal_user';
};

export type SubmitAppealPayload = {
  /** 被申诉警告/处罚的 16 位 moderation_id（= GET /moderation/:id 的 id） */
  relatedModerationId: ExternalModerationId;
  /** 功能注释：须来自同 reasonTargetType 下列表返回的 code */
  reasonCode: string;
  /**
   * 与当前申诉对象类型一致：appeal_user / appeal_game / appeal_post。
   * 游戏/帖子必须显式传，否则后端默认 appeal_user 会校验失败。
   */
  reasonTargetType: AppealReasonTargetType;
  reason: string;
  evidenceKeys: string[];
};

export type SubmitAppealData = {
  /** 16 位数字字符串，跳转 /appeals/{appealId} */
  appealId: string;
  status: 'pending';
  relatedModerationId: ExternalModerationId;
};

export type AppealListItem = {
  /** 16 位申诉 id 字符串 */
  id: string;
  relatedModerationId: ExternalModerationId;
  status: AppealStatus;
  reasonCode?: string | null;
  reasonTitle?: string | null;
  reason?: string | null;
  evidenceUrls?: string[];
  reviewNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  notifyBody?: string | null;
  targetOwnerNickname?: string | null;
  targetOwnerUserCode?: string | null;
  /** 仅作品对象 */
  gameTitle?: string | null;
};

export type AppealListData = {
  list: AppealListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AppealTargetSnapshot = {
  /** 被申诉记录的 16 位 moderation_id */
  id: ExternalModerationId;
  recordType?: string | null;
  level?: number | null;
  status?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  notifyBody?: string | null;
  createdAt?: string | null;
};

export type AppealDetail = AppealListItem & {
  target?: AppealTargetSnapshot | null;
};

export type AdminAppealStatus = 'pending' | 'approved' | 'rejected' | string;

export type AdminAppealListItem = {
  /** 16 位 appealId */
  id: string;
  userId: string;
  relatedModerationId: ExternalModerationId;
  status: AdminAppealStatus;
  reason?: string | null;
  evidenceUrls?: string[];
  createdAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  targetRecordType?: string | null;
  targetLevel?: number | null;
  notifyBody?: string | null;
};

export type AdminAppealListData = {
  list: AdminAppealListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAppealDetail = AdminAppealListItem & {
  target?: AppealTargetSnapshot | null;
  reviewerUserId?: string | null;
};

export type AdminAppealReviewPayload = {
  decision: 'approve' | 'reject';
  reviewNote?: string;
};

export type AdminAppealReviewEffects = {
  revokedWarning?: boolean;
  revokedPenalty?: boolean;
  restoredGame?: boolean;
  gameHeldByOtherModeration?: boolean;
  clearedPunishment?: boolean;
};

export type AdminAppealReviewResult = {
  appealId: string;
  status: AdminAppealStatus;
  /** reject 时为 null；approve 时用于 toast 分支 */
  effects?: AdminAppealReviewEffects | null;
};
