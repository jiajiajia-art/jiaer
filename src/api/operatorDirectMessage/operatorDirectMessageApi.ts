import type { ApiResponse } from '../api.types';
import { api } from '../base';

export type DirectMessageRecipient = {
  userId: string;
  userCode: string;
  nickname: string;
  phoneNumber: string;
};

export type OperatorDirectMessage = {
  id: number;
  userId: string;
  title: string;
  body: string;
  createdByUserId: string;
  createdByNickname: string | null;
  createdAt: string | null;
  recipientNickname?: string;
  recipientUserCode?: string;
  recipientPhoneNumber?: string;
};

type ListPayload = {
  list: OperatorDirectMessage[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const operatorDirectMessageApi = {
  searchRecipients(keyword: string) {
    return api.get<ApiResponse<{ list: DirectMessageRecipient[] }>>(
      '/operator/direct-messages/recipients',
      { params: { keyword } },
    );
  },

  list(params: { keyword?: string; page?: number; pageSize?: number } = {}) {
    return api.get<ApiResponse<ListPayload>>('/operator/direct-messages', { params });
  },

  send(body: { userId: string; title: string; body: string }) {
    return api.post<ApiResponse<OperatorDirectMessage>>('/operator/direct-messages', body);
  },
};

export default operatorDirectMessageApi;
