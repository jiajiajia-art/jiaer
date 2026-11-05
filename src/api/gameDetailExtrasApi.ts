import type { ApiResponse } from './api.types';
import { api, UPLOAD_TIMEOUT_MS } from './base';

export type GameUpdateLogItem = {
  id: number;
  fileId: string;
  note: string;
  createdBy: string | null;
  createdAt: string;
};

export type GameIssueType = 'cannot_enter' | 'save_broken' | 'parse_error' | 'payment' | 'other';
export type GameIssueStatus = 'pending' | 'in_progress' | 'replied' | 'closed';

export type GameIssueFeedback = {
  id: number;
  ticketNo: string;
  fileId: string;
  gameTitle: string;
  issueType: GameIssueType;
  content: string;
  screenshotUrls: string[];
  userId: string | null;
  status: GameIssueStatus;
  internalNote?: string;
  createdAt: string;
  updatedAt?: string;
};

const gameDetailExtrasApi = {
  listUpdateLogs(fileId: string) {
    return api.get<ApiResponse<{ list: GameUpdateLogItem[]; latest: GameUpdateLogItem | null }>>(
      `/auth/games/${encodeURIComponent(fileId)}/update-logs`,
    );
  },

  uploadIssueScreenshot(file: File) {
    const form = new FormData();
    form.append('file', file);
    return api.post<ApiResponse<{ key: string; url: string }>>(
      '/customer-service/game-issue/screenshots',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
      },
    );
  },

  createIssueFeedback(body: {
    fileId: string;
    gameTitle?: string;
    issueType: GameIssueType;
    content: string;
    screenshotUrls?: string[];
  }) {
    return api.post<ApiResponse<GameIssueFeedback>>('/customer-service/game-issue', body);
  },

  listIssueFeedbackAdmin(params: {
    status?: GameIssueStatus | '';
    fileId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    return api.get<ApiResponse<{
      list: GameIssueFeedback[];
      total: number;
      page: number;
      pageSize: number;
    }>>('/operator/customer-service/game-issues', { params });
  },

  getIssueFeedbackAdmin(id: number) {
    return api.get<ApiResponse<GameIssueFeedback>>(
      `/operator/customer-service/game-issues/${id}`,
    );
  },

  patchIssueFeedbackAdmin(id: number, body: { status?: GameIssueStatus; internalNote?: string }) {
    return api.patch<ApiResponse<GameIssueFeedback>>(
      `/operator/customer-service/game-issues/${id}`,
      body,
    );
  },
};

export default gameDetailExtrasApi;
