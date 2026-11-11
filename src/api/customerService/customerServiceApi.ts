import type { ApiResponse } from '../api.types';
import { api, UPLOAD_TIMEOUT_MS } from '../base';

export type FeedbackType = 'bug' | 'game' | 'payment' | 'product' | 'other';
export type FeedbackStatus = 'pending' | 'in_progress' | 'replied' | 'closed';
export type CoopType = 'brand' | 'content' | 'channel' | 'procurement' | 'other';
export type CoopStatus = 'pending' | 'communicating' | 'won' | 'closed';

export type SiteFeedback = {
  id: number;
  ticketNo: string;
  feedbackType: FeedbackType;
  content: string;
  screenshotUrls: string[];
  contact: string;
  userId: string | null;
  status: FeedbackStatus;
  internalNote: string;
  replyBody: string;
  repliedAt: string | null;
  handlerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessCoopNote = {
  id: number;
  cooperationId: number;
  authorUserId: string;
  authorName: string;
  note: string;
  createdAt: string;
};

export type BusinessCooperation = {
  id: number;
  ticketNo: string;
  coopType: CoopType;
  contactName: string;
  companyName: string;
  contact: string;
  description: string;
  status: CoopStatus;
  followerUserId: string | null;
  followerName: string;
  createdAt: string;
  updatedAt: string;
  notes?: BusinessCoopNote[];
};

type ListPayload<T> = {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
};

const customerServiceApi = {
  /** 功能注释：意见反馈截图，最多 3 张，字段名 file */
  uploadFeedbackScreenshot(file: File) {
    const form = new FormData();
    form.append('file', file);
    return api.post<ApiResponse<{ key: string; url: string }>>(
      '/customer-service/feedback/screenshots',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
      },
    );
  },

  createFeedback(body: {
    feedbackType: FeedbackType;
    content: string;
    contact?: string;
    screenshotUrls?: string[];
  }) {
    return api.post<ApiResponse<SiteFeedback>>('/customer-service/feedback', body);
  },

  createBusinessCoop(body: {
    coopType: CoopType;
    contactName: string;
    companyName: string;
    contact: string;
    description: string;
  }) {
    return api.post<ApiResponse<BusinessCooperation>>(
      '/customer-service/business-cooperation',
      body,
    );
  },

  listFeedback(params: {
    status?: FeedbackStatus | '';
    feedbackType?: FeedbackType | '';
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    return api.get<ApiResponse<ListPayload<SiteFeedback>>>(
      '/operator/customer-service/feedback',
      { params },
    );
  },

  getFeedback(id: number) {
    return api.get<ApiResponse<SiteFeedback>>(`/operator/customer-service/feedback/${id}`);
  },

  patchFeedback(id: number, body: { status?: FeedbackStatus; internalNote?: string }) {
    return api.patch<ApiResponse<SiteFeedback>>(
      `/operator/customer-service/feedback/${id}`,
      body,
    );
  },

  replyFeedback(id: number, body: { replyBody: string }) {
    return api.post<ApiResponse<SiteFeedback>>(
      `/operator/customer-service/feedback/${id}/reply`,
      body,
    );
  },

  listBusinessCoop(params: {
    status?: CoopStatus | '';
    coopType?: CoopType | '';
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    return api.get<ApiResponse<ListPayload<BusinessCooperation>>>(
      '/operator/customer-service/business-cooperation',
      { params },
    );
  },

  getBusinessCoop(id: number) {
    return api.get<ApiResponse<BusinessCooperation>>(
      `/operator/customer-service/business-cooperation/${id}`,
    );
  },

  patchBusinessCoop(id: number, body: {
    status?: CoopStatus;
    followerUserId?: string | null;
    followerName?: string;
  }) {
    return api.patch<ApiResponse<BusinessCooperation>>(
      `/operator/customer-service/business-cooperation/${id}`,
      body,
    );
  },

  addBusinessCoopNote(id: number, body: { note: string }) {
    return api.post<ApiResponse<BusinessCooperation>>(
      `/operator/customer-service/business-cooperation/${id}/notes`,
      body,
    );
  },
};

export default customerServiceApi;
