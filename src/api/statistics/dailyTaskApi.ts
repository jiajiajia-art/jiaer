import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { DailyTaskClaimRequest, DailyTaskPayload } from './dailyTask.type';

const dailyTaskApi = {
    getDailyTasks: () =>
        api.get<ApiResponse<DailyTaskPayload>>('/auth/tasks/daily-status'),
    acceptDailyTask: (taskId: number) =>
        api.post<ApiResponse<{ taskId: number; acceptedAt: string; dayKey: string }>>('/auth/tasks/daily/accept', {
            taskId,
        }),
    claimDailyTask: (payload: DailyTaskClaimRequest) =>
        api.post<ApiResponse<DailyTaskPayload | null>>('/auth/tasks/daily/claim', payload),
};

export default dailyTaskApi;
