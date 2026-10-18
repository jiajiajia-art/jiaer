/** 申诉 P1 — 对齐 API-申诉.md / §15 16 位 moderation_id */

export type AppealRecordType = 'warning' | 'penalty' | 'appeal';
export type AppealStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'active' | string;

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

export type SubmitAppealPayload = {
  /** 被申诉警告/处罚的 16 位 moderation_id（= GET /moderation/:id 的 id） */
  relatedModerationId: ExternalModerationId;
  /** 功能注释：GET /report/reasons?targetType=appeal 的 code */
  reasonCode: string;
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

export type AdminAppealReviewResult = {
  appealId: string;
  status: AdminAppealStatus;
};
