import type { ApiResponse } from '../api.types';
import { api, UPLOAD_TIMEOUT_MS } from '../base';
import {
  USE_REPORT_MOCK,
  mockBlockContent,
  mockGetReasons,
  mockSubmitReport,
  mockUploadEvidence,
} from './reportMock';
import type {
  ContentBlockPayload,
  ReportReasonsData,
  ReportTargetType,
  SubmitReportData,
  SubmitReportPayload,
  UploadEvidenceData,
} from './report.type';

const reportApi = {
  getReasons: (targetType: ReportTargetType) => {
    if (USE_REPORT_MOCK) return mockGetReasons(targetType);
    return api.get<ApiResponse<ReportReasonsData>>('/report/reasons', {
      params: { targetType },
    });
  },

  uploadEvidence: (file: File) => {
    if (USE_REPORT_MOCK) return mockUploadEvidence(file);
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<UploadEvidenceData>>('/report/evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },

  submit: (payload: SubmitReportPayload) => {
    if (USE_REPORT_MOCK) return mockSubmitReport(payload);
    return api.post<ApiResponse<SubmitReportData>>('/report', payload);
  },

  blockContent: (payload: ContentBlockPayload) => {
    if (USE_REPORT_MOCK) return mockBlockContent(payload);
    return api.post<ApiResponse<{
      targetType: string;
      targetId: string;
      blocked: boolean;
    }>>('/content/block', payload);
  },
};

export default reportApi;
export { USE_REPORT_MOCK };
