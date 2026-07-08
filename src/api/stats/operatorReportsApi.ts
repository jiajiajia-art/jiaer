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

export interface ReportQueryParams {
  granularity?: ReportGranularity;
  startDate?: string;
  endDate?: string;
  metrics?: string;
}

const operatorReportsApi = {
  getActivityTrends: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ActivityTrendsResponse>>('/operator/reports/activity-trends', { params }),
  getRegistrationTrend: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ActivityTrendsResponse>>('/operator/reports/registrations/trend', { params }),
  getConsumptionTrend: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ConsumptionTrendResponse>>('/operator/reports/consumption/trend', { params }),
  getActiveUsersSummary: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate'>) =>
    api.get<ApiResponse<ActiveUsersSummaryResponse>>('/operator/reports/active-users/summary', { params }),
};

export default operatorReportsApi;
