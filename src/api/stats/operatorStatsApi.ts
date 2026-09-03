import { api } from '../base';
import { dedupeInflight } from '../../lib/dedupeInflight';
import type { ApiResponse } from '../api.types';
import type { CreatorWorkDetail, CreatorWorkItem, StatsOverview } from './creatorStatsApi';

const overviewInflight = new Map<string, Promise<unknown>>();
const worksInflight = new Map<string, Promise<unknown>>();

/** 功能注释：将查询参数序列化为去重 key，避免 StrictMode 双 mount 重复打同一接口 */
function buildStatsParamsKey(prefix: string, params?: Record<string, string | number | undefined>) {
  if (!params) return prefix;
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);
  return entries.length ? `${prefix}:${entries.join('&')}` : prefix;
}

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
  getOverview: (params?: { startDate?: string; endDate?: string }) => {
    const key = buildStatsParamsKey('overview', params);
    return dedupeInflight(overviewInflight, key, () =>
      api.get<ApiResponse<StatsOverview & { publicWorkCount?: number }>>('/operator/stats/overview', {
        params,
        // 功能注释：全站汇总需扫 ~900 公开作品，给足超时避免 axios/浏览器提前中断
        timeout: 120_000,
      }),
    ) as ReturnType<
      typeof api.get<ApiResponse<StatsOverview & { publicWorkCount?: number }>>
    >;
  },
  getWorks: (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) => {
    const key = buildStatsParamsKey('works', params);
    return dedupeInflight(worksInflight, key, () =>
      api.get<ApiResponse<{ items: CreatorWorkItem[]; total: number; limit: number; offset: number }>>(
        '/operator/stats/works',
        { params },
      ),
    ) as ReturnType<
      typeof api.get<ApiResponse<{ items: CreatorWorkItem[]; total: number; limit: number; offset: number }>>
    >;
  },
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
