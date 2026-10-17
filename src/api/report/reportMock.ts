import type { ApiResponse } from '../api.types';
import type {
  ContentBlockPayload,
  ReportReasonItem,
  ReportReasonsData,
  ReportTargetType,
  SubmitReportData,
  SubmitReportPayload,
  UploadEvidenceData,
} from './report.type';

/** 功能注释：默认走真接口；仅 VITE_USE_REPORT_MOCK=true 时用假数据 */
export const USE_REPORT_MOCK =
  String(import.meta.env.VITE_USE_REPORT_MOCK ?? 'false').toLowerCase() === 'true';

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

const ok = <T>(data: T, message = 'ok'): { data: ApiResponse<T> } => ({
  data: { success: true, message, data },
});

export function throwReportMockError(code: string, message: string): never {
  const error = new Error(message) as Error & {
    response: { data: { success: false; code: string; message: string } };
  };
  error.response = { data: { success: false, code, message } };
  throw error;
}

const GAME_REASONS: ReportReasonItem[] = [
  {
    code: 'game_porn_explicit',
    category: '色情低俗',
    title: '裸露色情',
    description: '游戏内容包含裸露、性行为等直接色情内容',
  },
  {
    code: 'game_porn_suggestive',
    category: '色情低俗',
    title: '低俗擦边',
    description: '存在暗示性、擦边或不适宜展示',
  },
  {
    code: 'game_political_sensitive',
    category: '政治敏感',
    title: '不当政治表述',
    description: '涉及政治敏感话题或不当表述',
  },
  {
    code: 'game_plagiarism',
    category: '侵权',
    title: '抄袭搬运',
    description: '未经授权使用他人作品或素材',
  },
];

const USER_REASONS: ReportReasonItem[] = [
  {
    code: 'user_avatar_violation',
    category: '资料违规',
    title: '头像违规',
    description: '头像包含不当或违规内容',
  },
  {
    code: 'user_nickname_violation',
    category: '资料违规',
    title: '昵称违规',
    description: '昵称包含不当或违规内容',
  },
  {
    code: 'user_harassment',
    category: '行为违规',
    title: '骚扰辱骂',
    description: '存在骚扰、辱骂或其他不当行为',
  },
];

/** 开发时可改为对应 code，验证 toast；默认 null = 提交成功 */
export let mockReportSubmitErrorCode: string | null = null;

export const setMockReportSubmitErrorCode = (code: string | null) => {
  mockReportSubmitErrorCode = code;
};

export async function mockGetReasons(targetType: ReportTargetType) {
  await delay();
  const list =
    targetType === 'user' ? USER_REASONS : targetType === 'post' ? [] : GAME_REASONS;
  return ok<ReportReasonsData>({ list });
}

export async function mockUploadEvidence(file: File) {
  await delay(400);
  if (!file.type.startsWith('image/')) {
    throwReportMockError('invalid_reason', '仅支持图片证据');
  }
  if (file.size > 5 * 1024 * 1024) {
    throwReportMockError('invalid_reason', '单张图片不能超过 5MB');
  }
  const key = `mock/evidence/${Date.now()}_${encodeURIComponent(file.name)}`;
  return ok<UploadEvidenceData>({
    key,
    url: URL.createObjectURL(file),
  });
}

export async function mockSubmitReport(payload: SubmitReportPayload) {
  await delay(350);
  if (mockReportSubmitErrorCode) {
    const map: Record<string, string> = {
      duplicate_pending: '你已有一条待处理的举报',
      already_upheld: '该内容已处理，无需再次举报',
      report_cooldown: '驳回后需等待 7 天才能再次举报',
      cannot_report_self: '不能举报自己',
      target_not_found: '举报对象不存在',
      invalid_reason: '请选择有效的举报理由',
    };
    throwReportMockError(
      mockReportSubmitErrorCode,
      map[mockReportSubmitErrorCode] || '提交失败',
    );
  }
  if (!payload.reasonCode) {
    throwReportMockError('invalid_reason', '请选择有效的举报理由');
  }
  return ok<SubmitReportData>(
    { reportId: Math.floor(Math.random() * 100000) + 1, status: 'pending' },
    '已提交，我们会尽快处理',
  );
}

export async function mockBlockContent(_payload: ContentBlockPayload) {
  await delay(200);
  return ok<{ blocked: true }>({ blocked: true }, '已屏蔽');
}
