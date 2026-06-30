import type { ApiResponse } from '../api.types';
import { api } from '../base';

export type AdminDailyTaskStatus = 'draft' | 'published';
export type AdminDailyTaskKind = 'play_specific_game' | 'play_specific_game_duration';

export interface AdminDailyTaskConfig {
    id: number;
    title: string;
    description: string;
    taskKind: AdminDailyTaskKind;
    rewardPoints: number;
    targetCount?: number;
    targetSeconds?: number;
    gameFileId: string;
    gameTitle?: string;
    startAt?: string | null;
    endAt?: string | null;
    status: AdminDailyTaskStatus;
    sortOrder?: number | null;
    createdByUserId?: string;
    updatedByUserId?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AdminDailyTaskPayload {
    title: string;
    description: string;
    taskKind: AdminDailyTaskKind;
    rewardPoints: number;
    targetCount?: number;
    targetSeconds?: number;
    gameFileId: string;
    startAt?: string;
    endAt?: string;
    status: AdminDailyTaskStatus;
    sortOrder?: number;
}

const dailyTasksApi = {
    list: () =>
        api.get<ApiResponse<AdminDailyTaskConfig[]>>('/admin/daily-tasks/configs'),
    create: (payload: AdminDailyTaskPayload) =>
        api.post<ApiResponse<AdminDailyTaskConfig>>('/admin/daily-tasks/configs', payload),
    update: (id: number, payload: AdminDailyTaskPayload) =>
        api.put<ApiResponse<AdminDailyTaskConfig>>(`/admin/daily-tasks/configs/${id}`, payload),
    remove: (id: number) =>
        api.delete<ApiResponse<null>>(`/admin/daily-tasks/configs/${id}`),
};

export default dailyTasksApi;
