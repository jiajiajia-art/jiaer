import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { AnnouncementPayload, AnnouncementRecord, AnnouncementSummary } from './announcement.type';

const announcementApi = {
    getLatest: () =>
        api.get<ApiResponse<AnnouncementRecord>>('/auth/announcements/latest'),

    getAdminHistory: () =>
        api.get<ApiResponse<AnnouncementSummary[]>>('/admin/announcements'),

    getAdminDetail: (id: number) =>
        api.get<ApiResponse<AnnouncementRecord>>(`/admin/announcements/${id}`),

    create: (payload: AnnouncementPayload) =>
        api.post<ApiResponse<AnnouncementRecord>>('/admin/announcements', payload),

    update: (id: number, payload: AnnouncementPayload) =>
        api.put<ApiResponse<AnnouncementRecord>>(`/admin/announcements/${id}`, payload),

    publishCopy: (id: number, payload: Omit<AnnouncementPayload, 'status'>) =>
        api.post<ApiResponse<AnnouncementRecord>>(`/admin/announcements/${id}/publish-copy`, payload),

    remove: (id: number) =>
        api.delete<ApiResponse<boolean>>(`/admin/announcements/${id}`),
};

export default announcementApi;
