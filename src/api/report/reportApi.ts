import type { ApiResponse } from '../api.types';
import { api, UPLOAD_TIMEOUT_MS } from '../base';
import type {
  ContentBlockPayload,
  ReportReasonsData,
  ReportTargetType,
  SubmitReportData,
  SubmitReportPayload,
  UploadEvidenceData,
} from './report.type';

const reportApi = {
  getReasons: (targetType: ReportTargetType) =>
    api.get<ApiResponse<ReportReasonsData>>('/report/reasons', {
      params: { targetType },
    }),

  uploadEvidence: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<UploadEvidenceData>>('/report/evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },

  submit: (payload: SubmitReportPayload) =>
    api.post<ApiResponse<SubmitReportData>>('/report', payload),

  blockContent: (payload: ContentBlockPayload) =>
    api.post<ApiResponse<{
      targetType: string;
      targetId: string;
      blocked: boolean;
    }>>('/content/block', payload),
};

export default reportApi;
