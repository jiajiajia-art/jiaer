import { api } from '../base';
import type { ApiResponse } from '../api.types';

export type ReportGranularity = 'day' | 'week' | 'month';

export interface TrendPoint {
  bucket: string;
  value: number;
  momGrowth?: number | null;
}

export interface TrendSeries {
  key: string;
  label: string;
  points: TrendPoint[];
}

export interface ActivityTrendsResponse {
  granularity: ReportGranularity;
  startDate: string;
  endDate: string;
  series: TrendSeries[];
}

export interface RegistrationTrendResponse {
  granularity: ReportGranularity;
  startDate: string;
  endDate: string;
  series: TrendSeries[];
  summary: {
    total: number;
    userTotalCount: number;
  };
}

export interface ConsumptionTrendResponse {
  granularity: ReportGranularity;
  startDate: string;
  endDate: string;
  currency: 'points';
  series: TrendSeries[];
  summary: {
    total: number;
    latestBucket: string | null;
    latestValue: number;
    momGrowth: number | null;
    previousBucket: string | null;
    previousValue: number;
  };
}

export interface ActiveUsersSummaryResponse {
  startDate: string;
  endDate: string;
  metric: 'login_dau';
  latestDay: string;
  latestDau: number;
  averageDau: number;
  peakDau: number;
  points: TrendPoint[];
}

export interface NewUserRetentionPoint {
  register_date: string;
  new_users: number;
  retained_users: number;
  retention_rate: number;
}

export interface ActiveUserRetentionPoint {
  login_date: string;
  active_users: number;
  retained_users: number;
  retention_rate: number;
}

export interface RechargeSummaryByPlanItem {
  planId: string;
  label: string;
  userCount: number;
  orderCount: number;
  totalAmount: number;
  avgOrdersPerUser: number;
  avgAmountPerUser: number;
}

export interface RechargeSummaryByTypeItem {
  orderType: string;
  label: string;
  userCount: number;
  orderCount: number;
  totalAmount: number;
}

export interface RechargeSummaryResponse {
  startDate: string;
  endDate: string;
  totalAmount: number;
  totalOrders: number;
  totalUsers: number;
  byPlan: RechargeSummaryByPlanItem[];
  byType: RechargeSummaryByTypeItem[];
}

export interface RechargeTrendResponse {
  granularity: ReportGranularity;
  startDate: string;
  endDate: string;
  series: TrendSeries[];
  summary: {
    totalAmount: number;
    totalOrders: number;
    totalUsers: number;
  };
}

export interface ReportQueryParams {
  granularity?: ReportGranularity;
  startDate?: string;
  endDate?: string;
  metrics?: string;
  days?: number;
}

const operatorReportsApi = {
  getActivityTrends: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ActivityTrendsResponse>>('/operator/reports/activity-trends', { params }),
  getRegistrationTrend: (params?: ReportQueryParams) =>
    api.get<ApiResponse<RegistrationTrendResponse>>('/operator/reports/registrations/trend', { params }),
  getConsumptionTrend: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ConsumptionTrendResponse>>('/operator/reports/consumption/trend', { params }),
  getActiveUsersSummary: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate'>) =>
    api.get<ApiResponse<ActiveUsersSummaryResponse>>('/operator/reports/active-users/summary', { params }),
  getNewUserRetention: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'days'>) =>
    api.get<ApiResponse<NewUserRetentionPoint[]>>('/auth/stats/new-user-retention', { params }),
  getActiveUserRetention: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'days'>) =>
    api.get<ApiResponse<ActiveUserRetentionPoint[]>>('/auth/stats/active-user-retention', { params }),
  getRechargeSummary: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate'>) =>
    api.get<ApiResponse<RechargeSummaryResponse>>('/operator/reports/recharge/summary', { params }),
  getRechargeTrend: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'granularity'>) =>
    api.get<ApiResponse<RechargeTrendResponse>>('/operator/reports/recharge/trend', { params }),
};

export default operatorReportsApi;
