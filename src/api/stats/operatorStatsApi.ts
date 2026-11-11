import { api } from '../base';
import { dedupeInflight } from '../../lib/dedupeInflight';
import type { ApiResponse } from '../api.types';
import type { OperatorSortBy, OperatorStatsSearchType } from '../../utils/operatorStatsRange';

const overviewInflight = new Map<string, Promise<unknown>>();
const worksInflight = new Map<string, Promise<unknown>>();
const dailyInflight = new Map<string, Promise<unknown>>();

/** 功能注释：将查询参数序列化为去重 key，避免 StrictMode 双 mount 重复打同一接口 */
function buildStatsParamsKey(prefix: string, params?: object) {
  if (!params) return prefix;
  const entries = Object.entries(params as Record<string, string | number | undefined>)
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

/** 功能注释：运营统计公共指标（接口 WorkMetrics） */
export interface OperatorWorkMetrics {
  pv: number;
  uv: number;
  likeCount: number;
  favoriteCount: number;
  shareCount?: number;
  shareUv?: number;
  playCount: number;
  playUv?: number;
  playDurationSeconds: number;
  commentCount: number;
  /** Creator creation/testing points, excluding player play points. */
  spendPoints: number;
  /** Net player KK spend, in minor units. */
  spendKkMinor: number;
  aiTokens: number;
  aiCallCount?: number;
  aiInputTokens?: number;
  aiOutputTokens?: number;
  aiCachedInputTokens?: number;
  billedKkMinor?: number;
}

export type OperatorDeltaRatio = Partial<Record<keyof OperatorWorkMetrics, number | null>>;

export interface OperatorStatsOverview extends OperatorWorkMetrics {
  workCount?: number;
  publicWorkCount?: number;
  previous?: Partial<OperatorWorkMetrics>;
  deltaRatio?: OperatorDeltaRatio;
  dataAsOf?: string;
  timezone?: string;
}

export interface OperatorWorkListItem {
  rank: number;
  rankDelta: number | null;
  fileId: string;
  title: string;
  coverUrl: string | null;
  creatorUserId: string | null;
  creatorNickname: string | null;
  createdAt: string | null;
  publishedAt: string | null;
  updatedAt?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  metrics: OperatorWorkMetrics;
}

export type OperatorWorksResolveType =
  | 'none'
  | 'workExact'
  | 'workList'
  | 'author'
  | 'authorAmbiguous'
  | 'empty';

export type { OperatorStatsSearchType };

export interface OperatorWorksResolve {
  type: OperatorWorksResolveType;
  fileId: string | null;
  creatorUserId: string | null;
}

export interface OperatorWorksResponse {
  items: OperatorWorkListItem[];
  total: number;
  limit: number;
  offset: number;
  sortBy: OperatorSortBy | string;
  order: 'asc' | 'desc' | string;
  resolve?: OperatorWorksResolve;
}

export interface OperatorWorkDetail extends OperatorWorkMetrics {
  fileId: string;
  title: string;
  coverUrl: string | null;
  creatorUserId: string | null;
  creatorNickname: string | null;
  createdAt: string | null;
  publishedAt: string | null;
  rank: number | null;
  sortBy: string;
  previous?: Partial<OperatorWorkMetrics>;
  deltaRatio?: OperatorDeltaRatio;
  activeHours?: Array<{ hour: number; count: number }>;
  dataAsOf?: string;
  timezone?: string;
  comments?: Array<{
    ratingId: string;
    userId: string;
    nickname: string | null;
    ratingValue: number | null;
    commentContent: string;
    createdAt: string;
  }>;
}

export interface OperatorWorkDailyDay {
  /** 始终 YYYY-MM-DD */
  date: string;
  pv: number;
  uv: number;
  playCount: number;
  playDurationSeconds: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  spendPoints: number;
  spendKkMinor: number;
  aiTokens: number;
}

export interface OperatorWorkDailyResponse {
  fileId: string;
  timezone: string;
  /** 固定 day */
  grain: 'day' | string;
  startDate?: string | null;
  endDate?: string | null;
  total: number;
  limit: number;
  offset: number;
  days: OperatorWorkDailyDay[];
}

export interface OperatorWorkDailyParams {
  /** 有限区间成对传入；「全部」都不传，由服务端用 published_at～今天 */
  startDate?: string;
  endDate?: string;
  /** 仅「全部」分页；默认 50，最大 200 */
  limit?: number;
  offset?: number;
}

export interface OperatorStatsDateParams {
  startDate?: string;
  endDate?: string;
  /** 作者维度 KPI；与 works 过滤同一 creatorUserId */
  creatorUserId?: string;
}

export interface OperatorWorksQueryParams extends OperatorStatsDateParams {
  sortBy?: OperatorSortBy | string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  q?: string;
  /** 有 q 时必填：title|fileId|nickname|userCode|phone */
  searchType?: OperatorStatsSearchType | string;
  creatorUserId?: string;
}

export interface OperatorWorkDetailParams extends OperatorStatsDateParams {
  sortBy?: OperatorSortBy | string;
  order?: 'asc' | 'desc';
  q?: string;
  searchType?: OperatorStatsSearchType;
  commentLimit?: number;
}

const operatorStatsApi = {
  getOverview: (params?: OperatorStatsDateParams) => {
    const key = buildStatsParamsKey('overview', params);
    return dedupeInflight(overviewInflight, key, () =>
      api.get<ApiResponse<OperatorStatsOverview>>('/operator/stats/overview', {
        params,
        // 功能注释：全站汇总需扫公开作品，给足超时避免 axios/浏览器提前中断
        timeout: 120_000,
      }),
    ) as ReturnType<typeof api.get<ApiResponse<OperatorStatsOverview>>>;
  },
  getWorks: (params?: OperatorWorksQueryParams) => {
    const key = buildStatsParamsKey('works', params);
    return dedupeInflight(worksInflight, key, () =>
      api.get<ApiResponse<OperatorWorksResponse>>('/operator/stats/works', {
        params,
        timeout: 120_000,
      }),
    ) as ReturnType<typeof api.get<ApiResponse<OperatorWorksResponse>>>;
  },
  getWorkDetail: (fileId: string, params?: OperatorWorkDetailParams) =>
    api.get<ApiResponse<OperatorWorkDetail>>(`/operator/stats/works/${fileId}`, {
      params,
      timeout: 120_000,
    }),
  getWorkDaily: (fileId: string, params?: OperatorWorkDailyParams) => {
    const key = buildStatsParamsKey(`daily:${fileId}`, params as Record<string, string | number | undefined>);
    return dedupeInflight(dailyInflight, key, () =>
      api.get<ApiResponse<OperatorWorkDailyResponse>>(`/operator/stats/works/${fileId}/daily`, {
        params,
        timeout: 120_000,
      }),
    ) as ReturnType<typeof api.get<ApiResponse<OperatorWorkDailyResponse>>>;
  },
  getRecruitmentOverview: (params?: OperatorStatsDateParams) =>
    api.get<ApiResponse<RecruitmentOverview>>('/operator/recruitment/overview', { params }),
  getRecruitmentUsers: (params?: OperatorStatsDateParams & { limit?: number; offset?: number }) =>
    api.get<ApiResponse<{ users: RecruitmentUserItem[]; total: number; limit: number; offset: number }>>(
      '/operator/recruitment/users',
      { params },
    ),
  getRecruitmentTrend: (params?: OperatorStatsDateParams) =>
    api.get<ApiResponse<{ trend: Array<{ day: string; inviteCount: number }> }>>(
      '/operator/recruitment/trend',
      { params },
    ),
  getDailyTasksConfig: () =>
    api.get<ApiResponse<{ tasks: DailyTaskConfigItem[] }>>('/operator/daily-tasks/config'),
};

export default operatorStatsApi;
