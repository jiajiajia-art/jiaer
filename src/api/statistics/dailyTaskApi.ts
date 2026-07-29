import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { DailyTaskClaimRequest, DailyTaskPayload } from './dailyTask.type';

const dailyTaskApi = {
    getDailyTasks: () =>
        api.get<ApiResponse<DailyTaskPayload>>('/auth/tasks/daily-status'),
    acceptDailyTask: (taskId: number) =>
        // game_promotion 首次 accept 时后端会返回 promotionCode / promotionLink
        api.post<ApiResponse<{
            taskId: number;
            acceptedAt: string;
            dayKey: string;
            promotionCode?: string | null;
            promotionLink?: string | null;
        }>>('/auth/tasks/daily/accept', {
            taskId,
        }),
    claimDailyTask: (payload: DailyTaskClaimRequest) =>
        api.post<ApiResponse<DailyTaskPayload | null>>('/auth/tasks/daily/claim', payload),
};

export default dailyTaskApi;
