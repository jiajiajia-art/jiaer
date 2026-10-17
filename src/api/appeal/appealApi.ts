import type { ApiResponse } from '../api.types';
import { api, UPLOAD_TIMEOUT_MS } from '../base';
import {
  USE_APPEAL_MOCK,
  mockGetAppeal,
  mockGetEligible,
  mockListAppeals,
  mockSubmitAppeal,
  mockUploadEvidence,
} from './appealMock';
import type {
  AppealDetail,
  AppealEligibleData,
  AppealListData,
  AppealUploadEvidenceData,
  SubmitAppealData,
  SubmitAppealPayload,
} from './appeal.type';

const appealApi = {
  getEligible: () => {
    if (USE_APPEAL_MOCK) return mockGetEligible();
    return api.get<ApiResponse<AppealEligibleData>>('/appeals/eligible');
  },

  uploadEvidence: (file: File) => {
    if (USE_APPEAL_MOCK) return mockUploadEvidence(file);
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<AppealUploadEvidenceData>>('/appeals/evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },

  submit: (payload: SubmitAppealPayload) => {
    if (USE_APPEAL_MOCK) return mockSubmitAppeal(payload);
    return api.post<ApiResponse<SubmitAppealData>>('/appeals', payload);
  },

  listMine: (params?: { page?: number; pageSize?: number }) => {
    if (USE_APPEAL_MOCK) return mockListAppeals(params);
    return api.get<ApiResponse<AppealListData>>('/appeals', { params });
  },

  getMine: (id: number) => {
    if (USE_APPEAL_MOCK) return mockGetAppeal(id);
    return api.get<ApiResponse<AppealDetail>>(`/appeals/${id}`);
  },
};

export default appealApi;
export { USE_APPEAL_MOCK };
