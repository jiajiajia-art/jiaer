import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
    MessageCenterData,
    MessageReadAllResult,
    MessageReadPayload,
    MessageReadResult,
    MessageUnreadCountData,
} from './message.type';

const messageApi = {
    list: () =>
        api.get<ApiResponse<MessageCenterData>>('/auth/messages'),

    getUnreadCount: () =>
        api.get<ApiResponse<MessageUnreadCountData>>('/auth/messages/unread-count'),

    markAllRead: () =>
        api.post<ApiResponse<MessageReadAllResult>>('/auth/messages/read-all'),

    markRead: (payload: MessageReadPayload) =>
        api.post<ApiResponse<MessageReadResult>>('/auth/messages/read', payload),
};

export default messageApi;
