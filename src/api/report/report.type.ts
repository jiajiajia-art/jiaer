/** 内容举报 / 屏蔽 — 契约类型（对齐计划书 §5） */

export type ReportTargetType = 'game' | 'user' | 'post';

export type ReportReasonItem = {
  /** 小类 code，提交举报时作为 reasonCode */
  code: string;
  /** 大类名，列表按此分组 */
  category?: string | null;
  /** 小类标题 */
  title: string;
  description: string;
};

export type ReportReasonsData = {
  list: ReportReasonItem[];
};

export type SubmitReportPayload = {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: string;
  detail?: string;
  evidenceKeys?: string[];
};

export type SubmitReportData = {
  reportId: number;
  status: 'pending';
};

export type UploadEvidenceData = {
  key: string;
  url?: string;
};

export type ContentBlockPayload = {
  targetType: 'game' | 'post';
  targetId: string;
};

/** 举报提交业务错误码（R10 / R11） */
export type ReportErrorCode =
  | 'invalid_reason'
  | 'duplicate_pending'
  | 'already_upheld'
  | 'report_cooldown'
  | 'cannot_report_self'
  | 'target_not_found';
