import type { ApiResponse } from '../api.types';
import { api, authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type {
    AdminPromotionRewardTaskFilters,
    AdminPromotionRewardTaskListResult,
    AdminPromotionSubmissionFilters,
    AdminPromotionSubmissionListResult,
    AdminManualPointAdjustPayload,
    AdminManualPointAdjustResult,
    AdminPointsLookupMode,
    AdminPointsUserLookupResult,
    HomePromotionTicker,
    HomePromotionTickerPayload,
    PromotionActivity,
    PromotionActivityPayload,
    PromotionRewardTask,
    PromotionSubmission,
} from './promotion.type';

async function parseUploadResponse(response: Response): Promise<ApiResponse<{ imageUrl: string }>> {
    const data = await response.json() as ApiResponse<{ imageUrl: string }>;
    if (!response.ok || !data.success) {
        throw new Error(data.message || '推广图片上传失败');
    }
    return data;
}

const promotionApi = {
    list: () =>
        api.get<ApiResponse<PromotionActivity[]>>('/auth/promotions'),

    detail: (id: number) =>
        api.get<ApiResponse<PromotionActivity>>(`/auth/promotions/${id}`),

    getHomeTicker: () =>
        api.get<ApiResponse<HomePromotionTicker | null>>('/auth/promotions/home-ticker'),

    mySubmissions: () =>
        api.get<ApiResponse<PromotionSubmission[]>>('/auth/promotions/my-submissions'),

    submit: async (activityId: number, formData: FormData) => {
        const response = await authFetch(`${HOST_ADDRESS}/api/auth/promotions/${activityId}/submissions`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json() as ApiResponse<PromotionSubmission>;
        if (!response.ok || !data.success) {
            throw new Error(data.message || '投稿失败');
        }
        return { data };
    },

    adminList: () =>
        api.get<ApiResponse<PromotionActivity[]>>('/admin/promotions'),

    adminCreate: (payload: PromotionActivityPayload) =>
        api.post<ApiResponse<PromotionActivity>>('/admin/promotions', payload),

    adminGetHomeTicker: () =>
        api.get<ApiResponse<HomePromotionTicker>>('/admin/promotions/home-ticker'),

    adminUpdateHomeTicker: (payload: HomePromotionTickerPayload) =>
        api.put<ApiResponse<HomePromotionTicker>>('/admin/promotions/home-ticker', payload),

    adminUpdate: (id: number, payload: PromotionActivityPayload) =>
        api.put<ApiResponse<PromotionActivity>>(`/admin/promotions/${id}`, payload),

    adminDelete: (id: number) =>
        api.delete<ApiResponse<boolean>>(`/admin/promotions/${id}`),

    adminUploadImage: async (formData: FormData) => {
        const response = await authFetch(`${HOST_ADDRESS}/api/admin/promotions/upload`, {
            method: 'POST',
            body: formData,
        });
        return { data: await parseUploadResponse(response) };
    },

    adminSubmissions: (params: AdminPromotionSubmissionFilters) =>
        api.get<ApiResponse<AdminPromotionSubmissionListResult>>('/admin/promotions/submissions', { params }),

    adminSubmissionDetail: (id: number) =>
        api.get<ApiResponse<PromotionSubmission>>(`/admin/promotions/submissions/${id}`),

    adminReviewSubmission: (id: number, payload: { reviewStatus: string; reviewRemark?: string }) =>
        api.post<ApiResponse<PromotionSubmission>>(`/admin/promotions/submissions/${id}/review`, payload),

    adminRewardTasks: (params: AdminPromotionRewardTaskFilters) =>
        api.get<ApiResponse<AdminPromotionRewardTaskListResult>>('/admin/promotions/reward-tasks', { params }),

    adminIssueAllRewardTasks: () =>
        api.post<ApiResponse<{ issuedCount: number; skippedCount: number }>>('/admin/promotions/reward-tasks/issue-all'),

    adminIssueRewardTask: (id: number) =>
        api.post<ApiResponse<{ task: PromotionRewardTask; remainingPoints: number }>>(`/admin/promotions/reward-tasks/${id}/issue`),

    lookupAdminPointsUser: (mode: AdminPointsLookupMode, keyword: string) =>
        api.get<ApiResponse<AdminPointsUserLookupResult>>('/admin/points/users/lookup', {
            params: { mode, keyword },
        }),

    manualAdjustAdminPoints: (payload: AdminManualPointAdjustPayload) =>
        api.post<ApiResponse<AdminManualPointAdjustResult>>('/admin/points/manual-adjust', payload),
};

export default promotionApi;
