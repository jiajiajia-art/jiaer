import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
    ActivityBannerAdminData,
    ActivityBannerPublicData,
    ActivityBannerPublishPayload,
} from './activityBanner.type';

const activityBannerApi = {
    getAdmin: () =>
        api.get<ApiResponse<ActivityBannerAdminData>>('/admin/activity-banners'),

    createDraft: () =>
        api.post<ApiResponse<ActivityBannerAdminData>>('/admin/activity-banners/drafts'),

    stage: (id: number, banner: ActivityBannerPublishPayload['banners'][number]) =>
        api.post<ApiResponse<ActivityBannerAdminData>>(`/admin/activity-banners/${id}/stage`, { banner }),

    unpublish: (id: number) =>
        api.post<ApiResponse<ActivityBannerAdminData>>(`/admin/activity-banners/${id}/unpublish`),

    publish: (payload: ActivityBannerPublishPayload) =>
        api.post<ApiResponse<ActivityBannerAdminData>>('/admin/activity-banners/publish', payload),

    deleteById: (id: number) =>
        api.delete<ApiResponse<ActivityBannerAdminData>>(`/admin/activity-banners/${id}`),

    getLatest: () =>
        api.get<ApiResponse<ActivityBannerPublicData>>('/auth/activity-banners/latest'),
};

export default activityBannerApi;
