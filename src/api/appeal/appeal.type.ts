/** 申诉 P1 — 对齐 API-申诉.md */

export type AppealRecordType = 'warning' | 'penalty' | 'appeal';
export type AppealStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'active' | string;

export type AppealEligibleItem = {
  id: number;
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
  relatedId: number;
  reason: string;
  evidenceKeys: string[];
};

export type SubmitAppealData = {
  appealId: number;
  status: 'pending';
  relatedId: number;
};

export type AppealListItem = {
  id: number;
  relatedId: number;
  status: AppealStatus;
  reason?: string | null;
  evidenceUrls?: string[];
  reviewNote?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
  notifyBody?: string | null;
};

export type AppealListData = {
  list: AppealListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AppealTargetSnapshot = {
  id: number;
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
  id: number;
  userId: string;
  relatedId: number;
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
  appealId: number;
  status: AdminAppealStatus;
};
