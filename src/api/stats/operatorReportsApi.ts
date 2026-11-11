import { api } from '../base';
import type { ApiResponse } from '../api.types';

export type ReportGranularity = 'day' | 'week' | 'month';
export type ReportPlatform = 'all' | 'pc' | 'mini_program';
export type ReportDataSource = 'funloom' | 'fhl';
export type FhlReportChannel = 'all' | 'douyin' | 'xiaohongshu' | 'qq' | 'unknown';
export type FhlReportDeviceType = 'all' | 'pc' | 'mobile' | 'tablet';

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
  dataSource?: ReportDataSource;
  granularity: ReportGranularity;
  startDate: string;
  endDate: string;
  series: TrendSeries[];
  summary: {
    total: number;
    userTotalCount: number | null;
    deviceRegistrations?: Array<{
      deviceType: 'pc' | 'mobile' | 'tablet';
      registrations: number;
      ratio: number;
    }>;
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
  dataSource?: ReportDataSource;
  startDate: string;
  endDate: string;
  metric: 'login_dau' | 'fhl_active_user';
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

export interface FhlReportError {
  code: string;
  message: string;
}

export interface FhlChannelBreakdownRow {
  channel: 'douyin' | 'xiaohongshu' | 'qq' | 'unknown' | string;
  visits: number;
  registrations: number;
  validUsers: number;
  activeUsers: number;
  interactions?: number;
  payingUsers?: number;
  payments: number;
  revenueCents: number;
}

export interface FhlCampaignBreakdownRow {
  campaignId: string;
  visits: number;
  registrations: number;
  validUsers: number;
  activeUsers: number;
  interactions?: number;
  payingUsers?: number;
  payments: number;
  revenueCents: number;
}

export interface FhlChannelBreakdownResponse {
  dataSource: 'fhl';
  startDate: string;
  endDate: string;
  partial?: boolean;
  error?: FhlReportError;
  rows: FhlChannelBreakdownRow[];
}

export interface FhlCampaignBreakdownResponse extends Omit<FhlChannelBreakdownResponse, 'rows'> {
  rows: FhlCampaignBreakdownRow[];
}

export interface FhlOnboardingFunnelRow {
  step: 'intro_start' | 'intro_complete' | 'tutorial_start' | 'tutorial_complete' | 'valid_user';
  users: number;
  conversionRate: number;
}

export interface FhlOnboardingFunnelResponse {
  dataSource: 'fhl';
  startDate: string;
  endDate: string;
  partial?: boolean;
  error?: FhlReportError;
  rows: FhlOnboardingFunnelRow[];
}

export interface FhlRetentionRow {
  cohortDate: string;
  newValidUsers: number;
  nextDayRetained: number;
  nextDayRetentionRate: number;
  thirdDayRetained: number;
  thirdDayRetentionRate: number;
}

export interface FhlRetentionResponse {
  dataSource: 'fhl';
  startDate: string;
  endDate: string;
  partial?: boolean;
  error?: FhlReportError;
  rows: FhlRetentionRow[];
}

export interface ReportQueryParams {
  granularity?: ReportGranularity;
  startDate?: string;
  endDate?: string;
  metrics?: string;
  days?: number;
  platform?: ReportPlatform;
  dataSource?: ReportDataSource;
  channel?: FhlReportChannel;
  campaignId?: string;
  deviceType?: FhlReportDeviceType;
}

const operatorReportsApi = {
  getActivityTrends: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ActivityTrendsResponse>>('/operator/reports/activity-trends', { params }),
  getRegistrationTrend: (params?: ReportQueryParams) =>
    api.get<ApiResponse<RegistrationTrendResponse>>('/operator/reports/registrations/trend', { params }),
  getConsumptionTrend: (params?: ReportQueryParams) =>
    api.get<ApiResponse<ConsumptionTrendResponse>>('/operator/reports/consumption/trend', { params }),
  getActiveUsersSummary: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'dataSource'>) =>
    api.get<ApiResponse<ActiveUsersSummaryResponse>>('/operator/reports/active-users/summary', { params }),
  getNewUserRetention: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'days' | 'platform'>) =>
    api.get<ApiResponse<NewUserRetentionPoint[]>>('/auth/stats/new-user-retention', { params }),
  getActiveUserRetention: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'days' | 'platform'>) =>
    api.get<ApiResponse<ActiveUserRetentionPoint[]>>('/auth/stats/active-user-retention', { params }),
  getRechargeSummary: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'platform' | 'dataSource'>) =>
    api.get<ApiResponse<RechargeSummaryResponse>>('/operator/reports/recharge/summary', { params }),
  getRechargeTrend: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'granularity' | 'platform' | 'dataSource'>) =>
    api.get<ApiResponse<RechargeTrendResponse>>('/operator/reports/recharge/trend', { params }),
  getFhlChannelBreakdown: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'deviceType'>) =>
    api.get<ApiResponse<FhlChannelBreakdownResponse>>('/operator/reports/fhl/channel', { params }),
  getFhlCampaignBreakdown: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'campaignId' | 'deviceType'>) =>
    api.get<ApiResponse<FhlCampaignBreakdownResponse>>('/operator/reports/fhl/campaign', { params }),
  getFhlOnboardingFunnel: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'channel' | 'deviceType'>) =>
    api.get<ApiResponse<FhlOnboardingFunnelResponse>>('/operator/reports/fhl/onboarding', { params }),
  getFhlRetention: (params?: Pick<ReportQueryParams, 'startDate' | 'endDate' | 'channel' | 'deviceType'>) =>
    api.get<ApiResponse<FhlRetentionResponse>>('/operator/reports/fhl/retention', { params }),
};

export default operatorReportsApi;
