import type { ApiResponse } from '../api.types';
import type {
  AppealDetail,
  AppealEligibleData,
  AppealEligibleItem,
  AppealListData,
  AppealListItem,
  AppealUploadEvidenceData,
  SubmitAppealData,
  SubmitAppealPayload,
} from './appeal.type';

/** 功能注释：默认走真接口；仅 VITE_USE_APPEAL_MOCK=true 时用假数据 */
export const USE_APPEAL_MOCK =
  String(import.meta.env.VITE_USE_APPEAL_MOCK ?? 'false').toLowerCase() === 'true';

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

const ok = <T>(data: T, message = 'ok'): { data: ApiResponse<T> } => ({
  data: { success: true, message, data },
});

export function throwAppealMockError(code: string, message: string): never {
  const error = new Error(message) as Error & {
    response: { data: { success: false; code: string; message: string } };
  };
  error.response = { data: { success: false, code, message } };
  throw error;
}

const MOCK_ELIGIBLE: AppealEligibleItem = {
  id: 45,
  recordType: 'warning',
  level: null,
  status: 'active',
  sourceType: 'game',
  sourceId: 'mock_file_taken_down',
  notifyBody: '你的作品因违反平台规范已被下架，并记一次警告。',
  createdAt: new Date(Date.now() - 86400000).toISOString(),
  canAppeal: true,
  appealDeadline: new Date(Date.now() + 6 * 86400000).toISOString(),
};

let mockMine: AppealListItem[] = [];
let mockNextId = 1001;

export async function mockGetEligible() {
  await delay();
  const appealed = new Set(mockMine.map((item) => item.relatedId));
  const list = appealed.has(MOCK_ELIGIBLE.id)
    ? []
    : [MOCK_ELIGIBLE];
  return ok<AppealEligibleData>({ list });
}

export async function mockUploadEvidence(file: File) {
  await delay(400);
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throwAppealMockError('invalid_evidence', '仅支持 jpg / png / webp 图片');
  }
  if (file.size > 5 * 1024 * 1024) {
    throwAppealMockError('invalid_evidence', '单张图片不能超过 5MB');
  }
  const key = `interactive-fiction-appeal-evidence/mock/${Date.now()}_${encodeURIComponent(file.name)}`;
  return ok<AppealUploadEvidenceData>({
    key,
    url: URL.createObjectURL(file),
  });
}

export async function mockSubmitAppeal(payload: SubmitAppealPayload) {
  await delay(350);
  const reason = String(payload.reason || '').trim();
  if (!reason || reason.length > 1000) {
    throwAppealMockError('invalid_reason', '请填写有效申诉理由（不超过 1000 字）');
  }
  if (!payload.evidenceKeys?.length) {
    throwAppealMockError('invalid_evidence', '请至少上传 1 张证据图');
  }
  if (payload.relatedId !== MOCK_ELIGIBLE.id) {
    throwAppealMockError('target_not_found', '申诉对象不存在或不属于你');
  }
  if (mockMine.some((item) => item.relatedId === payload.relatedId)) {
    throwAppealMockError('duplicate_appeal', '该记录已申诉过');
  }

  const appealId = mockNextId++;
  const row: AppealListItem = {
    id: appealId,
    relatedId: payload.relatedId,
    status: 'pending',
    reason,
    evidenceUrls: payload.evidenceKeys,
    createdAt: new Date().toISOString(),
  };
  mockMine = [row, ...mockMine];
  return ok<SubmitAppealData>(
    { appealId, status: 'pending', relatedId: payload.relatedId },
    '申诉已提交，我们将在 3～7 个工作日内复核',
  );
}

export async function mockListAppeals(params?: { page?: number; pageSize?: number }) {
  await delay();
  const page = Math.max(1, params?.page || 1);
  const pageSize = Math.max(1, params?.pageSize || 20);
  const start = (page - 1) * pageSize;
  return ok<AppealListData>({
    list: mockMine.slice(start, start + pageSize),
    total: mockMine.length,
    page,
    pageSize,
  });
}

export async function mockGetAppeal(id: number) {
  await delay();
  const row = mockMine.find((item) => item.id === id);
  if (!row) {
    throwAppealMockError('target_not_found', '申诉不存在');
  }
  const detail: AppealDetail = {
    ...row,
    target: {
      id: MOCK_ELIGIBLE.id,
      recordType: MOCK_ELIGIBLE.recordType,
      level: MOCK_ELIGIBLE.level,
      status: MOCK_ELIGIBLE.status,
      sourceType: MOCK_ELIGIBLE.sourceType,
      sourceId: MOCK_ELIGIBLE.sourceId,
      notifyBody: MOCK_ELIGIBLE.notifyBody,
      createdAt: MOCK_ELIGIBLE.createdAt,
    },
  };
  return ok<AppealDetail>(detail);
}
