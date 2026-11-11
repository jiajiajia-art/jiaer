import type { ApiResponse } from '../api.types';
import { api, UPLOAD_TIMEOUT_MS } from '../base';
import type { ReportReasonsData } from '../report/report.type';
import type {
  AppealDetail,
  AppealEligibleData,
  AppealListData,
  AppealReasonTargetType,
  AppealUploadEvidenceData,
  SubmitAppealData,
  SubmitAppealPayload,
} from './appeal.type';

const appealApi = {
  getEligible: () =>
    api.get<ApiResponse<AppealEligibleData>>('/appeals/eligible'),

  /** 功能注释：按申诉对象类型拉原因；勿再用 targetType=appeal */
  getReasonOptions: (targetType: AppealReasonTargetType) =>
    api.get<ApiResponse<ReportReasonsData>>('/report/reasons', {
      params: { targetType },
    }),

  uploadEvidence: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<AppealUploadEvidenceData>>('/appeals/evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },

  submit: (payload: SubmitAppealPayload) =>
    api.post<ApiResponse<SubmitAppealData>>('/appeals', payload),

  listMine: (params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<AppealListData>>('/appeals', { params }),

  getMine: (id: string) =>
    api.get<ApiResponse<AppealDetail>>(`/appeals/${id}`),
};

export default appealApi;
