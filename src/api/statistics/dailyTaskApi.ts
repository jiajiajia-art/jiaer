import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { DailyTaskClaimType, DailyTaskPayload } from './dailyTask.type';

const dailyTaskApi = {
    getDailyTasks: () =>
        api.get<ApiResponse<DailyTaskPayload>>('/auth/tasks/daily-status'),
    claimDailyTask: (taskCode: DailyTaskClaimType) =>
        api.post<ApiResponse<DailyTaskPayload | null>>('/auth/tasks/daily/claim', {
            taskCode,
        }),
};

export default dailyTaskApi;
