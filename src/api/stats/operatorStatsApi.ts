import { api } from '../base';
import type { ApiResponse } from '../api.types';
import type { CreatorWorkDetail, CreatorWorkItem, StatsOverview } from './creatorStatsApi';

export interface RecruitmentOverview {
  totalInvites: number;
  promotionSubmissions: number;
  activeEntryUsers: number;
}

export interface RecruitmentUserItem {
  userId: string;
  nickname: string;
  maskedPhone: string;
  inviteCount: number;
}

export interface DailyTaskConfigItem {
  code: string;
  title: string;
  description: string;
  rewardPoints: number;
  targetCount: number;
  targetSeconds: number;
}

const operatorStatsApi = {
  getOverview: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<StatsOverview & { publicWorkCount?: number }>>('/operator/stats/overview', { params }),
  getWorks: (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<{ items: CreatorWorkItem[]; total: number; limit: number; offset: number }>>('/operator/stats/works', { params }),
  getWorkDetail: (fileId: string, params?: { startDate?: string; endDate?: string; commentLimit?: number }) =>
    api.get<ApiResponse<CreatorWorkDetail>>(`/operator/stats/works/${fileId}`, { params }),
  getRecruitmentOverview: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<RecruitmentOverview>>('/operator/recruitment/overview', { params }),
  getRecruitmentUsers: (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<{ users: RecruitmentUserItem[]; total: number; limit: number; offset: number }>>('/operator/recruitment/users', { params }),
  getRecruitmentTrend: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<{ trend: Array<{ day: string; inviteCount: number }> }>>('/operator/recruitment/trend', { params }),
  getDailyTasksConfig: () =>
    api.get<ApiResponse<{ tasks: DailyTaskConfigItem[] }>>('/operator/daily-tasks/config'),
};

export default operatorStatsApi;
