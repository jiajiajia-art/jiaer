import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts';
import operatorReportsApi, {
  type ActiveUsersSummaryResponse,
  type ActiveUserRetentionPoint,
  type ActivityTrendsResponse,
  type FhlCampaignBreakdownResponse,
  type ConsumptionTrendResponse,
  type FhlOnboardingFunnelResponse,
  type FhlReportDeviceType,
  type FhlRetentionResponse,
  type NewUserRetentionPoint,
  type RechargeSummaryResponse,
  type RechargeTrendResponse,
  type RegistrationTrendResponse,
  type ReportDataSource,
  type ReportGranularity,
  type ReportPlatform,
} from '../../api/stats/operatorReportsApi';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import metricStyles from '../../components/admin/MetricSummary.module.css';
import PageSectionHeader from '../../components/Admin/PageSectionHeader';
import styles from './OperatorReports.module.css';
import {
  buildPresetRange,
  filterFhlCampaignRows,
  buildReportRequestParams,
  formatPercent,
  mergeSeriesForChart,
} from '../../utils/operatorReportChart';

const ACTIVITY_COLORS: Record<string, string> = {
  submission: '#c9733f',
  pv: '#2f81f7',
  comment: '#23d18b',
  share: '#b15cff',
  interaction: '#d05f2d',
};

const RECHARGE_COLORS: Record<string, string> = {
  recharge: '#2f81f7',
  orders: '#d29922',
  users: '#23a26d',
};

const FHL_RETENTION_COLORS: Record<string, string> = {
  nextDayRetentionPct: '#2f81f7',
  thirdDayRetentionPct: '#d05f2d',
};

const RETENTION_DAY_OPTIONS = [1, 7] as const;
const DATA_SOURCE_OPTIONS: Array<{ value: ReportDataSource; labelKey: string }> = [
  { value: 'funloom', labelKey: 'operator.reports.dataSourceFunloom' },
  { value: 'fhl', labelKey: 'operator.reports.dataSourceFhl' },
];
const FHL_DEVICE_FILTER_OPTIONS: Array<{ value: FhlReportDeviceType; labelKey: string }> = [
  { value: 'all', labelKey: 'operator.reports.fhlDeviceAll' },
  { value: 'pc', labelKey: 'operator.reports.fhlDevicePc' },
  { value: 'mobile', labelKey: 'operator.reports.fhlDeviceMobile' },
  { value: 'tablet', labelKey: 'operator.reports.fhlDeviceTablet' },
];
const PLATFORM_OPTIONS: Array<{ value: ReportPlatform; labelKey: string }> = [
  { value: 'all', labelKey: 'operator.reports.platformAll' },
  { value: 'pc', labelKey: 'operator.reports.platformPc' },
  { value: 'mini_program', labelKey: 'operator.reports.platformMiniProgram' },
];

type PlatformSelectProps = {
  value: ReportPlatform;
  onChange: (value: ReportPlatform) => void;
};

const PlatformSelect: React.FC<PlatformSelectProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <label className={styles.filterGroup}>
      <span>{t('operator.reports.platform')}</span>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as ReportPlatform)}
      >
        {PLATFORM_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
};

type ReportSectionKey =
  | 'activity'
  | 'registration'
  | 'consumption'
  | 'activeUsers'
  | 'newUserRetention'
  | 'activeUserRetention'
  | 'fhlCampaign'
  | 'fhlOnboarding'
  | 'fhlRetention'
  | 'rechargeSummary'
  | 'rechargeTrend';

const INITIAL_LOADING_STATE: Record<ReportSectionKey, boolean> = {
  activity: false,
  registration: false,
  consumption: false,
  activeUsers: false,
  newUserRetention: false,
  activeUserRetention: false,
  fhlCampaign: false,
  fhlOnboarding: false,
  fhlRetention: false,
  rechargeSummary: false,
  rechargeTrend: false,
};

type RetentionTooltipRow = {
  retentionRatePct: number;
  baseUsers: number;
  retainedUsers: number;
  baseUsersLabel: string;
  retainedUsersLabel: string;
};

type RetentionTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    payload?: RetentionTooltipRow;
  }>;
};

const RetentionTooltip: React.FC<RetentionTooltipProps> = ({ active, label, payload }) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;

  if (!data) return null;

  return (
    <div className={styles.tooltipCard}>
      <div className={styles.tooltipTitle}>{label}</div>
      <div className={styles.tooltipRow}>
        <span>{payload[0]?.name}</span>
        <strong>{data.retentionRatePct.toFixed(2)}%</strong>
      </div>
      <div className={styles.tooltipRow}>
        <span>{data.baseUsersLabel}</span>
        <strong>{data.baseUsers}</strong>
      </div>
      <div className={styles.tooltipRow}>
        <span>{data.retainedUsersLabel}</span>
        <strong>{data.retainedUsers}</strong>
      </div>
    </div>
  );
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);

const formatTooltipCurrency = (value: number | string | readonly (number | string)[] | undefined) => {
  if (Array.isArray(value)) return value.map((item) => formatCurrency(Number(item)));
  return formatCurrency(Number(value ?? 0));
};

const formatTooltipScalarNumber = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const numeric = Number(raw || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('zh-CN').format(numeric) : String(raw ?? 0);
};

const formatTooltipScalarCurrency = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const numeric = Number(raw || 0);
  return formatCurrency(Number.isFinite(numeric) ? numeric : 0);
};

const formatRechargeTrendTooltip = (
  value: unknown,
  name: string | number | undefined,
  item?: { dataKey?: unknown },
): [string, string | number] => [
  item?.dataKey === 'recharge' ? formatTooltipScalarCurrency(value) : formatTooltipScalarNumber(value),
  name ?? '',
];

const deviceTypeLabelKeys: Record<string, string> = {
  pc: 'operator.reports.fhlDevicePc',
  mobile: 'operator.reports.fhlDeviceMobile',
  tablet: 'operator.reports.fhlDeviceTablet',
};

const onboardingStepLabelKeys: Record<string, string> = {
  intro_start: 'operator.reports.fhlIntroStart',
  intro_complete: 'operator.reports.fhlIntroComplete',
  tutorial_start: 'operator.reports.fhlTutorialStart',
  tutorial_complete: 'operator.reports.fhlTutorialComplete',
  valid_user: 'operator.reports.fhlValidUser',
};

const hasPartialError = (data?: { partial?: boolean; error?: { message?: string } } | null) =>
  Boolean(data?.partial || data?.error);

const sumNumeric = <T,>(items: T[], readValue: (item: T) => number | null | undefined): number =>
  items.reduce((sum, item) => sum + Number(readValue(item) || 0), 0);

const divideOrZero = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

const countInclusiveDays = (start: string, end: string): number => {
  const startMs = new Date(`${start}T00:00:00+08:00`).getTime();
  const endMs = new Date(`${end}T00:00:00+08:00`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return 1;
  }
  return Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
};

const OperatorReports: React.FC = () => {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<ReportGranularity>('day');
  const [retentionDays, setRetentionDays] = useState<(typeof RETENTION_DAY_OPTIONS)[number]>(1);
  const [startDate, setStartDate] = useState(() => buildPresetRange(30).startDate);
  const [endDate, setEndDate] = useState(() => buildPresetRange(30).endDate);
  const [presetDays, setPresetDays] = useState<7 | 30>(30);
  const [dataSource, setDataSource] = useState<ReportDataSource>('funloom');
  const [activityData, setActivityData] = useState<ActivityTrendsResponse | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationTrendResponse | null>(null);
  const [consumptionData, setConsumptionData] = useState<ConsumptionTrendResponse | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUsersSummaryResponse | null>(null);
  const [newUserRetention, setNewUserRetention] = useState<NewUserRetentionPoint[]>([]);
  const [activeUserRetention, setActiveUserRetention] = useState<ActiveUserRetentionPoint[]>([]);
  const [fhlCampaignData, setFhlCampaignData] = useState<FhlCampaignBreakdownResponse | null>(null);
  const [fhlCampaignOptionsData, setFhlCampaignOptionsData] = useState<FhlCampaignBreakdownResponse | null>(null);
  const [fhlSummaryCampaignData, setFhlSummaryCampaignData] = useState<FhlCampaignBreakdownResponse | null>(null);
  const [fhlOnboardingData, setFhlOnboardingData] = useState<FhlOnboardingFunnelResponse | null>(null);
  const [fhlRetentionData, setFhlRetentionData] = useState<FhlRetentionResponse | null>(null);
  const [rechargeSummary, setRechargeSummary] = useState<RechargeSummaryResponse | null>(null);
  const [rechargeTrend, setRechargeTrend] = useState<RechargeTrendResponse | null>(null);
  const [registrationPlatform, setRegistrationPlatform] = useState<ReportPlatform>('all');
  const [newUserRetentionPlatform, setNewUserRetentionPlatform] = useState<ReportPlatform>('all');
  const [activeUserRetentionPlatform, setActiveUserRetentionPlatform] = useState<ReportPlatform>('all');
  const [rechargeSummaryPlatform, setRechargeSummaryPlatform] = useState<ReportPlatform>('all');
  const [activityPlatform, setActivityPlatform] = useState<ReportPlatform>('all');
  const [consumptionPlatform, setConsumptionPlatform] = useState<ReportPlatform>('all');
  const [rechargeTrendPlatform, setRechargeTrendPlatform] = useState<ReportPlatform>('all');
  const [fhlCampaignId, setFhlCampaignId] = useState('all');
  const [fhlCampaignDeviceType, setFhlCampaignDeviceType] = useState<FhlReportDeviceType>('all');
  const [fhlSegmentDeviceType, setFhlSegmentDeviceType] = useState<FhlReportDeviceType>('all');
  const [loadingSections, setLoadingSections] = useState<Record<ReportSectionKey, boolean>>(INITIAL_LOADING_STATE);
  const batchRequestIdRef = useRef(0);
  const registrationPlatformMountedRef = useRef(false);
  const activityPlatformMountedRef = useRef(false);
  const consumptionPlatformMountedRef = useRef(false);
  const newUserRetentionPlatformMountedRef = useRef(false);
  const activeUserRetentionPlatformMountedRef = useRef(false);
  const rechargeTrendPlatformMountedRef = useRef(false);
  const rechargeSummaryPlatformMountedRef = useRef(false);

  const isFhlDataSource = dataSource === 'fhl';
  const queryParams = useMemo(() => ({ granularity, startDate, endDate }), [granularity, startDate, endDate]);
  const retentionQueryParams = useMemo(
    () => ({ startDate, endDate, days: retentionDays }),
    [endDate, retentionDays, startDate],
  );

  const setSectionLoading = useCallback((section: ReportSectionKey, isLoading: boolean) => {
    setLoadingSections((prev) => (prev[section] === isLoading ? prev : { ...prev, [section]: isLoading }));
  }, []);

  // 活跃度趋势（独立 platform）
  const loadActivityTrends = useCallback(async (requestId?: number) => {
    setSectionLoading('activity', true);
    try {
      const resp = await operatorReportsApi.getActivityTrends(
        buildReportRequestParams(queryParams, dataSource, activityPlatform),
      );
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setActivityData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] activity-trends failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('activity', false);
      }
    }
  }, [queryParams, dataSource, activityPlatform, setSectionLoading]);

  // 注册用户增长（独立 platform）
  const loadRegistrationTrend = useCallback(async (requestId?: number) => {
    setSectionLoading('registration', true);
    try {
      const resp = await operatorReportsApi.getRegistrationTrend(
        buildReportRequestParams(queryParams, dataSource, registrationPlatform),
      );
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setRegistrationData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] registrations/trend failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('registration', false);
      }
    }
  }, [queryParams, dataSource, registrationPlatform, setSectionLoading]);

  // 积分消费趋势（独立 platform）
  const loadConsumptionTrend = useCallback(async (requestId?: number) => {
    setSectionLoading('consumption', true);
    try {
      const resp = await operatorReportsApi.getConsumptionTrend(
        buildReportRequestParams(queryParams, dataSource, consumptionPlatform),
      );
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setConsumptionData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] consumption/trend failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('consumption', false);
      }
    }
  }, [queryParams, dataSource, consumptionPlatform, setSectionLoading]);

  // DAU 指标（无 platform，日期变化时重请求）
  const loadActiveUsersSummary = useCallback(async (requestId?: number) => {
    setSectionLoading('activeUsers', true);
    try {
      const resp = await operatorReportsApi.getActiveUsersSummary({ startDate, endDate, dataSource });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setActiveUsers(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] active-users/summary failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('activeUsers', false);
      }
    }
  }, [startDate, endDate, dataSource, setSectionLoading]);

  // 注册留存（独立 platform）
  const loadNewUserRetention = useCallback(async (requestId?: number) => {
    setSectionLoading('newUserRetention', true);
    try {
      if (isFhlDataSource) {
        setNewUserRetention([]);
        return;
      }
      const resp = await operatorReportsApi.getNewUserRetention({ ...retentionQueryParams, platform: newUserRetentionPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setNewUserRetention(resp.data.data || []);
    } catch (e) {
      console.error('[OperatorReports] new-user-retention failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('newUserRetention', false);
      }
    }
  }, [retentionQueryParams, newUserRetentionPlatform, isFhlDataSource, setSectionLoading]);

  // 活跃留存（独立 platform）
  const loadActiveUserRetention = useCallback(async (requestId?: number) => {
    setSectionLoading('activeUserRetention', true);
    try {
      if (isFhlDataSource) {
        setActiveUserRetention([]);
        return;
      }
      const resp = await operatorReportsApi.getActiveUserRetention({ ...retentionQueryParams, platform: activeUserRetentionPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setActiveUserRetention(resp.data.data || []);
    } catch (e) {
      console.error('[OperatorReports] active-user-retention failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('activeUserRetention', false);
      }
    }
  }, [retentionQueryParams, activeUserRetentionPlatform, isFhlDataSource, setSectionLoading]);

  const loadFhlCampaignBreakdown = useCallback(async (requestId?: number) => {
    setSectionLoading('fhlCampaign', true);
    try {
      if (!isFhlDataSource) {
        setFhlCampaignData(null);
        setFhlCampaignOptionsData(null);
        setFhlSummaryCampaignData(null);
        return;
      }
      const baseParams = {
        startDate,
        endDate,
        deviceType: fhlCampaignDeviceType,
      };
      const dataRequest = operatorReportsApi.getFhlCampaignBreakdown({
        ...baseParams,
        campaignId: fhlCampaignId === 'all' ? undefined : fhlCampaignId,
      });
      const optionsRequest = fhlCampaignId === 'all'
        ? dataRequest
        : operatorReportsApi.getFhlCampaignBreakdown(baseParams);
      const summaryRequest = fhlCampaignDeviceType === 'all'
        ? optionsRequest
        : operatorReportsApi.getFhlCampaignBreakdown({ startDate, endDate, deviceType: 'all' });
      const [resp, optionsResp, summaryResp] = await Promise.all([dataRequest, optionsRequest, summaryRequest]);
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setFhlCampaignData(resp.data.data || null);
      if (optionsResp.data.success) setFhlCampaignOptionsData(optionsResp.data.data || null);
      if (summaryResp.data.success) setFhlSummaryCampaignData(summaryResp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] fhl/campaign failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('fhlCampaign', false);
      }
    }
  }, [endDate, fhlCampaignDeviceType, fhlCampaignId, isFhlDataSource, setSectionLoading, startDate]);

  const loadFhlOnboardingFunnel = useCallback(async (requestId?: number) => {
    setSectionLoading('fhlOnboarding', true);
    try {
      if (!isFhlDataSource) {
        setFhlOnboardingData(null);
        return;
      }
      const resp = await operatorReportsApi.getFhlOnboardingFunnel({
        startDate,
        endDate,
        deviceType: fhlSegmentDeviceType,
      });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setFhlOnboardingData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] fhl/onboarding failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('fhlOnboarding', false);
      }
    }
  }, [endDate, fhlSegmentDeviceType, isFhlDataSource, setSectionLoading, startDate]);

  const loadFhlRetention = useCallback(async (requestId?: number) => {
    setSectionLoading('fhlRetention', true);
    try {
      if (!isFhlDataSource) {
        setFhlRetentionData(null);
        return;
      }
      const resp = await operatorReportsApi.getFhlRetention({
        startDate,
        endDate,
        deviceType: fhlSegmentDeviceType,
      });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setFhlRetentionData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] fhl/retention failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('fhlRetention', false);
      }
    }
  }, [endDate, fhlSegmentDeviceType, isFhlDataSource, setSectionLoading, startDate]);

  // 充值趋势（独立 platform）
  const loadRechargeTrend = useCallback(async (requestId?: number) => {
    setSectionLoading('rechargeTrend', true);
    try {
      const resp = await operatorReportsApi.getRechargeTrend(
        buildReportRequestParams(queryParams, dataSource, rechargeTrendPlatform),
      );
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setRechargeTrend(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] recharge/trend failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('rechargeTrend', false);
      }
    }
  }, [queryParams, dataSource, rechargeTrendPlatform, setSectionLoading]);

  // 充值汇总（独立 platform）
  const loadRechargeSummary = useCallback(async (requestId?: number) => {
    setSectionLoading('rechargeSummary', true);
    try {
      const resp = await operatorReportsApi.getRechargeSummary(
        buildReportRequestParams({ startDate, endDate }, dataSource, rechargeSummaryPlatform),
      );
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setRechargeSummary(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] recharge/summary failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('rechargeSummary', false);
      }
    }
  }, [startDate, endDate, dataSource, rechargeSummaryPlatform, setSectionLoading]);

  useEffect(() => {
    const requestId = batchRequestIdRef.current + 1;
    batchRequestIdRef.current = requestId;

    const loadAllReports = async () => {
      await Promise.all([
        loadRegistrationTrend(requestId),
        loadActiveUsersSummary(requestId),
        loadActivityTrends(requestId),
        loadConsumptionTrend(requestId),
        loadNewUserRetention(requestId),
        loadActiveUserRetention(requestId),
        loadFhlCampaignBreakdown(requestId),
        loadFhlOnboardingFunnel(requestId),
        loadFhlRetention(requestId),
        loadRechargeTrend(requestId),
        loadRechargeSummary(requestId),
      ]);
    };

    void loadAllReports();
    // Platform changes are handled by the section-specific effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    granularity,
    startDate,
    endDate,
    retentionDays,
    dataSource,
    fhlCampaignId,
    fhlCampaignDeviceType,
    fhlSegmentDeviceType,
  ]);

  useEffect(() => {
    if (!registrationPlatformMountedRef.current) {
      registrationPlatformMountedRef.current = true;
      return;
    }
    void loadRegistrationTrend();
    // loadRegistrationTrend is recreated on platform change; depend only on the platform itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationPlatform]);

  useEffect(() => {
    if (!activityPlatformMountedRef.current) {
      activityPlatformMountedRef.current = true;
      return;
    }
    void loadActivityTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityPlatform]);

  useEffect(() => {
    if (!consumptionPlatformMountedRef.current) {
      consumptionPlatformMountedRef.current = true;
      return;
    }
    void loadConsumptionTrend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consumptionPlatform]);

  useEffect(() => {
    if (!newUserRetentionPlatformMountedRef.current) {
      newUserRetentionPlatformMountedRef.current = true;
      return;
    }
    void loadNewUserRetention();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newUserRetentionPlatform]);

  useEffect(() => {
    if (!activeUserRetentionPlatformMountedRef.current) {
      activeUserRetentionPlatformMountedRef.current = true;
      return;
    }
    void loadActiveUserRetention();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserRetentionPlatform]);

  useEffect(() => {
    if (!rechargeTrendPlatformMountedRef.current) {
      rechargeTrendPlatformMountedRef.current = true;
      return;
    }
    void loadRechargeTrend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechargeTrendPlatform]);

  useEffect(() => {
    if (!rechargeSummaryPlatformMountedRef.current) {
      rechargeSummaryPlatformMountedRef.current = true;
      return;
    }
    void loadRechargeSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechargeSummaryPlatform]);

  const applyPreset = (days: 7 | 30) => {
    const range = buildPresetRange(days);
    setPresetDays(days);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const activityChartData = useMemo(
    () => mergeSeriesForChart(activityData?.series || []),
    [activityData],
  );

  const registrationChartData = useMemo(
    () => mergeSeriesForChart(registrationData?.series || []),
    [registrationData],
  );

  const consumptionChartData = useMemo(
    () => consumptionData?.series[0]?.points || [],
    [consumptionData],
  );

  const rechargeTrendChartData = useMemo(
    () => mergeSeriesForChart(rechargeTrend?.series || []),
    [rechargeTrend],
  );

  const rechargePlanChartData = useMemo(
    () => rechargeSummary?.byPlan || [],
    [rechargeSummary],
  );

  const rechargeTypeChartData = useMemo(
    () => rechargeSummary?.byType || [],
    [rechargeSummary],
  );

  const newUserRetentionChartData = useMemo(
    () =>
      newUserRetention.map((item) => ({
        bucket: item.register_date,
        baseUsers: item.new_users,
        retainedUsers: item.retained_users,
        retentionRatePct: Number((item.retention_rate * 100).toFixed(2)),
        baseUsersLabel: t('operator.reports.newUsersLabel'),
        retainedUsersLabel: t('operator.reports.retainedUsersLabel'),
      })),
    [newUserRetention, t],
  );

  const activeUserRetentionChartData = useMemo(
    () =>
      activeUserRetention.map((item) => ({
        bucket: item.login_date,
        baseUsers: item.active_users,
        retainedUsers: item.retained_users,
        retentionRatePct: Number((item.retention_rate * 100).toFixed(2)),
        baseUsersLabel: t('operator.reports.activeUsersLabel'),
        retainedUsersLabel: t('operator.reports.retainedUsersLabel'),
      })),
    [activeUserRetention, t],
  );

  const fhlCampaignRows = useMemo(
    () =>
      filterFhlCampaignRows(fhlCampaignData?.rows, fhlCampaignId).map((row) => ({
        ...row,
        campaignLabel: row.campaignId === 'unknown' ? t('operator.reports.fhlCampaignUnknown') : row.campaignId,
        payingUsers: Number(row.payingUsers || 0),
        revenueAmount: row.revenueCents / 100,
        registrationRate: divideOrZero(row.registrations, row.visits),
        validUserRate: divideOrZero(row.validUsers, row.registrations),
        activeUserRate: divideOrZero(row.activeUsers, row.validUsers),
        payRate: divideOrZero(Number(row.payingUsers || 0), row.validUsers),
        arpu: divideOrZero(row.revenueCents / 100, row.validUsers),
        arppu: divideOrZero(row.revenueCents / 100, Number(row.payingUsers || 0)),
      })),
    [fhlCampaignData?.rows, fhlCampaignId, t],
  );

  const fhlCampaignFilterOptions = useMemo(() => {
    const ids = Array.from(new Set((fhlCampaignOptionsData?.rows || []).map((row) => row.campaignId || 'unknown')));
    ids.sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b, 'zh-CN', { numeric: true });
    });
    if (fhlCampaignId !== 'all' && !ids.includes(fhlCampaignId)) {
      ids.unshift(fhlCampaignId);
    }
    return ids;
  }, [fhlCampaignId, fhlCampaignOptionsData?.rows]);

  const fhlDeviceRegistrationRows = useMemo(
    () =>
      (registrationData?.summary.deviceRegistrations || []).map((row) => ({
        ...row,
        deviceLabel: t(deviceTypeLabelKeys[row.deviceType] || row.deviceType),
        ratioPct: Number((row.ratio * 100).toFixed(1)),
      })),
    [registrationData?.summary.deviceRegistrations, t],
  );

  const fhlSummary = useMemo(() => {
    const summaryRows = fhlSummaryCampaignData?.rows || fhlCampaignOptionsData?.rows || fhlCampaignData?.rows || [];
    const totalVisits = sumNumeric(summaryRows, (row) => row.visits);
    const totalRegistrations = registrationData?.summary.total ?? sumNumeric(summaryRows, (row) => row.registrations);
    const totalValidUsers = sumNumeric(summaryRows, (row) => row.validUsers);
    const totalActiveUsers = sumNumeric(summaryRows, (row) => row.activeUsers);
    const campaignPayingUsers = sumNumeric(summaryRows, (row) => row.payingUsers || 0);
    const revenueAmount = rechargeSummary?.totalAmount ?? sumNumeric(summaryRows, (row) => row.revenueCents / 100);
    const payingUsers = rechargeSummary?.totalUsers ?? campaignPayingUsers;
    const paymentOrders = rechargeSummary?.totalOrders ?? sumNumeric(summaryRows, (row) => row.payments);
    const interactionSeries = activityData?.series.find((series) => series.key === 'interaction');
    const totalInteractions = sumNumeric(interactionSeries?.points || [], (point) => point.value);

    return {
      totalVisits,
      totalRegistrations,
      totalValidUsers,
      totalActiveUsers,
      totalInteractions,
      avgDailyInteractions: totalInteractions / countInclusiveDays(startDate, endDate),
      activeUserRate: divideOrZero(totalActiveUsers, totalVisits),
      revenueAmount,
      payingUsers,
      paymentOrders,
      payRate: divideOrZero(payingUsers, totalValidUsers),
      arpu: divideOrZero(revenueAmount, totalValidUsers),
      arppu: divideOrZero(revenueAmount, payingUsers),
    };
  }, [activityData?.series, endDate, fhlCampaignData?.rows, fhlCampaignOptionsData?.rows, fhlSummaryCampaignData?.rows, rechargeSummary, registrationData?.summary.total, startDate]);

  const fhlOnboardingRows = useMemo(
    () =>
      (fhlOnboardingData?.rows || []).map((row) => ({
        ...row,
        stepLabel: t(onboardingStepLabelKeys[row.step]),
        conversionRatePct: Number((row.conversionRate * 100).toFixed(2)),
      })),
    [fhlOnboardingData?.rows, t],
  );

  const fhlRetentionChartData = useMemo(
    () =>
      (fhlRetentionData?.rows || []).map((row) => ({
        ...row,
        bucket: row.cohortDate,
        nextDayRetentionPct: Number((row.nextDayRetentionRate * 100).toFixed(2)),
        thirdDayRetentionPct: Number((row.thirdDayRetentionRate * 100).toFixed(2)),
      })),
    [fhlRetentionData?.rows],
  );

  const renderChartContent = useCallback(
    (loading: boolean, hasData: boolean, chart: React.ReactNode) => {
      if (hasData) return chart;
      return (
        <div className={styles.emptyState}>
          {loading ? t('creatorStats.loading') : '暂无数据'}
        </div>
      );
    },
    [t],
  );

  const renderFhlReportNotice = useCallback(
    (data: { partial?: boolean; error?: { message?: string } } | null, onRetry: () => void) => {
      if (!hasPartialError(data)) return null;
      return (
        <div className={styles.sectionError} role="status">
          <span>{t('operator.reports.fhlPartialError')}</span>
          <button type="button" onClick={onRetry}>
            {t('common.retry')}
          </button>
        </div>
      );
    },
    [t],
  );

  const renderTableBody = useCallback(
    (loading: boolean, hasRows: boolean, columnCount: number, rows: React.ReactNode) => {
      if (hasRows) return rows;
      return (
        <tr>
          <td colSpan={columnCount} className={styles.emptyState}>
            {loading ? t('creatorStats.loading') : '暂无数据'}
          </td>
        </tr>
      );
    },
    [t],
  );

  return (
    <div>
      <PageSectionHeader
        headingLevel="h1"
        title={t('operator.reports.title')}
        description={t('operator.reports.desc')}
      />

      <div className={styles.dataSourceSwitch} role="group" aria-label={t('operator.reports.dataSource')}>
        {DATA_SOURCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.dataSourceButton} ${dataSource === option.value ? styles.dataSourceButtonActive : ''}`}
            onClick={() => setDataSource(option.value)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>

      <div className={`${metricStyles.toolbar} ${styles.filters}`}>
        <button
          type="button"
          className={`${styles.presetButton} ${presetDays === 7 ? styles.presetButtonActive : ''}`}
          onClick={() => applyPreset(7)}
        >
          {t('operator.reports.last7Days')}
        </button>
        <button
          type="button"
          className={`${styles.presetButton} ${presetDays === 30 ? styles.presetButtonActive : ''}`}
          onClick={() => applyPreset(30)}
        >
          {t('operator.reports.last30Days')}
        </button>
        <label className={styles.filterGroup}>
          <span>{t('operator.reports.startDate')}</span>
          <input
            className={styles.dateInput}
            type="date"
            value={startDate}
            onChange={(event) => {
              setPresetDays(30);
              setStartDate(event.target.value);
            }}
          />
        </label>
        <label className={styles.filterGroup}>
          <span>{t('operator.reports.endDate')}</span>
          <input
            className={styles.dateInput}
            type="date"
            value={endDate}
            onChange={(event) => {
              setPresetDays(30);
              setEndDate(event.target.value);
            }}
          />
        </label>
        <label className={styles.filterGroup}>
          <span>{t('operator.reports.granularity')}</span>
          <select
            className={styles.select}
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as ReportGranularity)}
          >
            <option value="day">{t('operator.reports.granularityDay')}</option>
            <option value="week">{t('operator.reports.granularityWeek')}</option>
            <option value="month">{t('operator.reports.granularityMonth')}</option>
          </select>
        </label>
        {!isFhlDataSource && (
          <label className={styles.filterGroup}>
            <span>{t('operator.reports.retentionDays')}</span>
            <select
              className={styles.select}
              value={retentionDays}
              onChange={(event) => setRetentionDays(Number(event.target.value) as (typeof RETENTION_DAY_OPTIONS)[number])}
            >
              {RETENTION_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {t(days === 1 ? 'operator.reports.retentionDay1' : 'operator.reports.retentionDay7')}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className={metricStyles.grid}>
        {isFhlDataSource ? (
          <>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlVisitsTotal')}
                tip={t('operator.reports.fhlVisitsTotalTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.fhlCampaign && fhlSummaryCampaignData === null ? t('creatorStats.loading') : fhlSummary.totalVisits}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.registrationTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.registration && registrationData === null ? t('creatorStats.loading') : fhlSummary.totalRegistrations}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlValidUsersTotal')}
                tip={t('operator.reports.fhlValidUsersTotalTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.fhlCampaign && fhlSummaryCampaignData === null ? t('creatorStats.loading') : fhlSummary.totalValidUsers}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlActiveUsersTotal')}
                tip={t('operator.reports.fhlActiveUsersTotalTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.fhlCampaign && fhlSummaryCampaignData === null ? t('creatorStats.loading') : fhlSummary.totalActiveUsers}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlAvgDailyInteractions')}
                tip={t('operator.reports.fhlAvgDailyInteractionsTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.activity && activityData === null ? t('creatorStats.loading') : fhlSummary.avgDailyInteractions.toFixed(1)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlActiveUserRate')}
                tip={t('operator.reports.fhlActiveUserRateTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.fhlCampaign && fhlSummaryCampaignData === null ? t('creatorStats.loading') : formatPercent(fhlSummary.activeUserRate)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeAmountTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : formatCurrency(fhlSummary.revenueAmount)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeUsersTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : fhlSummary.payingUsers}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeOrdersTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : fhlSummary.paymentOrders}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlPayRate')}
                tip={t('operator.reports.fhlPayRateTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : formatPercent(fhlSummary.payRate)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlArpu')}
                tip={t('operator.reports.fhlArpuTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : formatCurrency(fhlSummary.arpu)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.fhlArppu')}
                tip={t('operator.reports.fhlArppuTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : formatCurrency(fhlSummary.arppu)}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.latestDau')}
                tip={t('operator.reports.dauTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.activeUsers && activeUsers === null ? t('creatorStats.loading') : (activeUsers?.latestDau ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.averageDau')}
                tip={t('operator.reports.averageDauTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.activeUsers && activeUsers === null ? t('creatorStats.loading') : (activeUsers?.averageDau ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.peakDau')}
                tip={t('operator.reports.peakDauTip')}
              />
              <div className={metricStyles.value}>
                {loadingSections.activeUsers && activeUsers === null ? t('creatorStats.loading') : (activeUsers?.peakDau ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.consumptionTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.consumption && consumptionData === null ? t('creatorStats.loading') : (consumptionData?.summary.total ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.registrationTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.registration && registrationData === null ? t('creatorStats.loading') : (registrationData?.summary.total ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.userTotalCount')}</div>
              <div className={metricStyles.value}>
                {loadingSections.registration && registrationData === null ? t('creatorStats.loading') : (registrationData?.summary.userTotalCount ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeAmountTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : formatCurrency(rechargeSummary?.totalAmount)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeOrdersTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : (rechargeSummary?.totalOrders ?? 0)}
              </div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeUsersTotal')}</div>
              <div className={metricStyles.value}>
                {loadingSections.rechargeSummary && rechargeSummary === null ? t('creatorStats.loading') : (rechargeSummary?.totalUsers ?? 0)}
              </div>
            </div>
          </>
        )}
      </div>

          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>
                {t(isFhlDataSource ? 'operator.reports.fhlActivityTitle' : 'operator.reports.activityTitle')}
              </h2>
              {!isFhlDataSource && <PlatformSelect value={activityPlatform} onChange={setActivityPlatform} />}
            </div>
            <p className={styles.sectionHint}>{t(isFhlDataSource ? 'operator.reports.fhlActivityHint' : 'operator.reports.activityHint')}</p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.activity,
                activityChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {(activityData?.series || []).map((series) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={t(`operator.reports.metrics.${series.key}`, { defaultValue: series.label })}
                        stroke={ACTIVITY_COLORS[series.key] || '#888'}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>,
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>
                {t(isFhlDataSource ? 'operator.reports.fhlRegistrationTitle' : 'operator.reports.registrationTitle')}
              </h2>
              {!isFhlDataSource && <PlatformSelect value={registrationPlatform} onChange={setRegistrationPlatform} />}
            </div>
            <p className={styles.sectionHint}>{t(isFhlDataSource ? 'operator.reports.fhlRegistrationHint' : 'operator.reports.registrationHint')}</p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.registration,
                registrationChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={registrationChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="registration" name={t('operator.reports.registrationLabel')} fill="#d29922" />
                  </BarChart>
                </ResponsiveContainer>,
              )}
            </div>
            {isFhlDataSource && (
              <div className={styles.deviceSplit}>
                <div className={styles.deviceSplitTitle}>{t('operator.reports.fhlDeviceRegistrationTitle')}</div>
                <div className={styles.deviceSplitRows}>
                  {fhlDeviceRegistrationRows.map((row) => (
                    <div className={styles.deviceSplitRow} key={row.deviceType}>
                      <div className={styles.deviceSplitLabel}>{row.deviceLabel}</div>
                      <div className={styles.deviceSplitBarTrack} aria-hidden="true">
                        <div
                          className={styles.deviceSplitBarFill}
                          style={{
                            width: `${Math.min(100, row.ratioPct)}%`,
                            minWidth: row.registrations > 0 ? 2 : 0,
                          }}
                        />
                      </div>
                      <div className={styles.deviceSplitValue}>
                        {row.registrations} / {row.ratioPct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {isFhlDataSource && (
            <section className={styles.section}>
              <div className={styles.sectionToolbar}>
                <h2 className={styles.sectionTitle}>{t('operator.reports.fhlCampaignTitle')}</h2>
                <div className={styles.inlineFilters}>
                  <label className={styles.filterGroup}>
                    <span>{t('operator.reports.fhlCampaignFilter')}</span>
                    <select
                      className={styles.select}
                      value={fhlCampaignId}
                      onChange={(event) => setFhlCampaignId(event.target.value)}
                    >
                      <option value="all">{t('operator.reports.fhlCampaignAll')}</option>
                      {fhlCampaignFilterOptions.map((campaignId) => (
                        <option key={campaignId} value={campaignId}>
                          {campaignId === 'unknown' ? t('operator.reports.fhlCampaignUnknown') : campaignId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.filterGroup}>
                    <span>{t('operator.reports.fhlDeviceFilter')}</span>
                    <select
                      className={styles.select}
                      value={fhlCampaignDeviceType}
                      onChange={(event) => setFhlCampaignDeviceType(event.target.value as FhlReportDeviceType)}
                    >
                      {FHL_DEVICE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <p className={styles.sectionHint}>{t('operator.reports.fhlCampaignHint')}</p>
              {renderFhlReportNotice(fhlCampaignData, () => void loadFhlCampaignBreakdown())}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('operator.reports.fhlCampaignLabel')}</th>
                      <th>{t('operator.reports.metrics.visit_game')}</th>
                      <th>{t('operator.reports.fhlRegistrationRate')}</th>
                      <th>{t('operator.reports.metrics.registration')}</th>
                      <th>{t('operator.reports.fhlValidUserRate')}</th>
                      <th>{t('operator.reports.metrics.valid_user')}</th>
                      <th>{t('operator.reports.fhlActiveUserRate')}</th>
                      <th>{t('operator.reports.metrics.active_user')}</th>
                      <th>{t('operator.reports.payingUsersLabel')}</th>
                      <th>{t('operator.reports.orderCountLabel')}</th>
                      <th>{t('operator.reports.fhlPayRate')}</th>
                      <th>{t('operator.reports.totalAmountLabel')}</th>
                      <th>{t('operator.reports.fhlArpu')}</th>
                      <th>{t('operator.reports.fhlArppu')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderTableBody(
                      loadingSections.fhlCampaign,
                      fhlCampaignRows.length > 0,
                      14,
                      <>
                        {fhlCampaignRows.map((row) => (
                          <tr key={row.campaignId}>
                            <td>{row.campaignLabel}</td>
                            <td>{row.visits}</td>
                            <td>{formatPercent(row.registrationRate)}</td>
                            <td>{row.registrations}</td>
                            <td>{formatPercent(row.validUserRate)}</td>
                            <td>{row.validUsers}</td>
                            <td>{formatPercent(row.activeUserRate)}</td>
                            <td>{row.activeUsers}</td>
                            <td>{row.payingUsers}</td>
                            <td>{row.payments}</td>
                            <td>{formatPercent(row.payRate)}</td>
                            <td>{formatCurrency(row.revenueAmount)}</td>
                            <td>{formatCurrency(row.arpu)}</td>
                            <td>{formatCurrency(row.arppu)}</td>
                          </tr>
                        ))}
                      </>,
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {isFhlDataSource && (
            <section className={styles.section}>
              <div className={styles.sectionToolbar}>
                <h2 className={styles.sectionTitle}>{t('operator.reports.fhlOnboardingTitle')}</h2>
                <div className={styles.inlineFilters}>
                  <label className={styles.filterGroup}>
                    <span>{t('operator.reports.fhlDeviceFilter')}</span>
                    <select
                      className={styles.select}
                      value={fhlSegmentDeviceType}
                      onChange={(event) => setFhlSegmentDeviceType(event.target.value as FhlReportDeviceType)}
                    >
                      {FHL_DEVICE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <p className={styles.sectionHint}>{t('operator.reports.fhlOnboardingHint')}</p>
              {renderFhlReportNotice(fhlOnboardingData, () => void loadFhlOnboardingFunnel())}
              <div className={styles.chartWrap}>
                {renderChartContent(
                  loadingSections.fhlOnboarding,
                  fhlOnboardingRows.length > 0,
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fhlOnboardingRows} layout="vertical" margin={{ left: 42, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="stepLabel" type="category" tick={{ fontSize: 12 }} width={118} />
                      <Tooltip />
                      <Bar dataKey="users" name={t('operator.reports.fhlUsersLabel')} fill="#23a26d" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>,
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('operator.reports.fhlOnboardingStep')}</th>
                      <th>{t('operator.reports.fhlUsersLabel')}</th>
                      <th>{t('operator.reports.fhlConversionRate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderTableBody(
                      loadingSections.fhlOnboarding,
                      fhlOnboardingRows.length > 0,
                      3,
                      <>
                        {fhlOnboardingRows.map((row) => (
                          <tr key={row.step}>
                            <td>{row.stepLabel}</td>
                            <td>{row.users}</td>
                            <td>{formatPercent(row.conversionRate)}</td>
                          </tr>
                        ))}
                      </>,
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {isFhlDataSource && (
            <section className={styles.section}>
              <div className={styles.sectionToolbar}>
                <h2 className={styles.sectionTitle}>{t('operator.reports.fhlRetentionTitle')}</h2>
                <div className={styles.inlineFilters}>
                  <label className={styles.filterGroup}>
                    <span>{t('operator.reports.fhlDeviceFilter')}</span>
                    <select
                      className={styles.select}
                      value={fhlSegmentDeviceType}
                      onChange={(event) => setFhlSegmentDeviceType(event.target.value as FhlReportDeviceType)}
                    >
                      {FHL_DEVICE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <p className={styles.sectionHint}>{t('operator.reports.fhlRetentionHint')}</p>
              {renderFhlReportNotice(fhlRetentionData, () => void loadFhlRetention())}
              <div className={styles.chartWrap}>
                {renderChartContent(
                  loadingSections.fhlRetention,
                  fhlRetentionChartData.length > 0,
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fhlRetentionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="nextDayRetentionPct"
                        name={t('operator.reports.fhlNextDayRetention')}
                        stroke={FHL_RETENTION_COLORS.nextDayRetentionPct}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="thirdDayRetentionPct"
                        name={t('operator.reports.fhlThirdDayRetention')}
                        stroke={FHL_RETENTION_COLORS.thirdDayRetentionPct}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>,
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('operator.reports.fhlCohortDate')}</th>
                      <th>{t('operator.reports.fhlNewValidUsers')}</th>
                      <th>{t('operator.reports.fhlNextDayRetention')}</th>
                      <th>{t('operator.reports.fhlThirdDayRetention')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderTableBody(
                      loadingSections.fhlRetention,
                      fhlRetentionChartData.length > 0,
                      4,
                      <>
                        {fhlRetentionChartData.map((row) => (
                          <tr key={row.cohortDate}>
                            <td>{row.cohortDate}</td>
                            <td>{row.newValidUsers}</td>
                            <td>{`${formatPercent(row.nextDayRetentionRate)} (${row.nextDayRetained})`}</td>
                            <td>{`${formatPercent(row.thirdDayRetentionRate)} (${row.thirdDayRetained})`}</td>
                          </tr>
                        ))}
                      </>,
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!isFhlDataSource && (
          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.consumptionTitle')}</h2>
              <PlatformSelect value={consumptionPlatform} onChange={setConsumptionPlatform} />
            </div>
            <p className={styles.sectionHint}>
              {t('operator.reports.consumptionHint')}
              {granularity === 'month' && consumptionData?.summary.momGrowth != null
                ? ` ${t('operator.reports.latestMomGrowth', { value: formatPercent(consumptionData.summary.momGrowth) })}`
                : ''}
            </p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.consumption,
                consumptionChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumptionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name={t('operator.reports.consumptionLabel')} fill="#e8940f" />
                  </BarChart>
                </ResponsiveContainer>,
              )}
            </div>
          </section>
          )}

          {!isFhlDataSource && (
          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.newUserRetentionTitle')}</h2>
              <PlatformSelect value={newUserRetentionPlatform} onChange={setNewUserRetentionPlatform} />
            </div>
            <p className={styles.sectionHint}>
              {t('operator.reports.newUserRetentionHint', {
                daysLabel: t(retentionDays === 1 ? 'operator.reports.retentionDay1' : 'operator.reports.retentionDay7'),
              })}
            </p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.newUserRetention,
                newUserRetentionChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={newUserRetentionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip content={<RetentionTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="retentionRatePct"
                      name={t('operator.reports.retentionRateLabel')}
                      stroke="#d05f2d"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>,
              )}
            </div>
          </section>
          )}

          {!isFhlDataSource && (
          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.activeUserRetentionTitle')}</h2>
              <PlatformSelect value={activeUserRetentionPlatform} onChange={setActiveUserRetentionPlatform} />
            </div>
            <p className={styles.sectionHint}>
              {t('operator.reports.activeUserRetentionHint', {
                daysLabel: t(retentionDays === 1 ? 'operator.reports.retentionDay1' : 'operator.reports.retentionDay7'),
              })}
            </p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.activeUserRetention,
                activeUserRetentionChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeUserRetentionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip content={<RetentionTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="retentionRatePct"
                      name={t('operator.reports.retentionRateLabel')}
                      stroke="#c9733f"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>,
              )}
            </div>
          </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.rechargeTrendTitle')}</h2>
              {!isFhlDataSource && <PlatformSelect value={rechargeTrendPlatform} onChange={setRechargeTrendPlatform} />}
            </div>
            <p className={styles.sectionHint}>{t('operator.reports.rechargeTrendHint')}</p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.rechargeTrend,
                rechargeTrendChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rechargeTrendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="amount" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={formatRechargeTrendTooltip} />
                    <Legend />
                    <Bar
                      yAxisId="amount"
                      dataKey="recharge"
                      name={t('operator.reports.rechargeMetrics.recharge')}
                      fill={RECHARGE_COLORS.recharge}
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="orders"
                      name={t('operator.reports.rechargeMetrics.orders')}
                      stroke={RECHARGE_COLORS.orders}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="users"
                      name={t('operator.reports.rechargeMetrics.users')}
                      stroke={RECHARGE_COLORS.users}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>,
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.rechargeSummaryTitle')}</h2>
              {!isFhlDataSource && <PlatformSelect value={rechargeSummaryPlatform} onChange={setRechargeSummaryPlatform} />}
            </div>
            <p className={styles.sectionHint}>{t('operator.reports.rechargeSummaryHint')}</p>

            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.rechargeSummary,
                rechargePlanChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rechargePlanChartData} layout="vertical" margin={{ left: 24, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip formatter={formatTooltipCurrency} />
                    <Bar
                      dataKey="totalAmount"
                      name={t('operator.reports.rechargePlanAmountLabel')}
                      fill="#d07a30"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>,
              )}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('operator.reports.planLabel')}</th>
                    <th>{t('operator.reports.payingUsersLabel')}</th>
                    <th>{t('operator.reports.orderCountLabel')}</th>
                    <th>{t('operator.reports.totalAmountLabel')}</th>
                    <th>{t('operator.reports.avgOrdersPerUserLabel')}</th>
                    <th>{t('operator.reports.avgAmountPerUserLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {renderTableBody(
                    loadingSections.rechargeSummary,
                    rechargePlanChartData.length > 0,
                    6,
                    <>
                      {rechargePlanChartData.map((item) => (
                        <tr key={item.planId}>
                          <td>{item.label}</td>
                          <td>{item.userCount}</td>
                          <td>{item.orderCount}</td>
                          <td>{formatCurrency(item.totalAmount)}</td>
                          <td>{item.avgOrdersPerUser.toFixed(2)}</td>
                          <td>{formatCurrency(item.avgAmountPerUser)}</td>
                        </tr>
                      ))}
                    </>,
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.rechargeSummary,
                rechargeTypeChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rechargeTypeChartData} layout="vertical" margin={{ left: 24, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip formatter={formatTooltipCurrency} />
                    <Bar
                      dataKey="totalAmount"
                      name={t('operator.reports.rechargeTypeAmountLabel')}
                      fill="#2f81f7"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>,
              )}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('operator.reports.typeLabel')}</th>
                    <th>{t('operator.reports.payingUsersLabel')}</th>
                    <th>{t('operator.reports.orderCountLabel')}</th>
                    <th>{t('operator.reports.totalAmountLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {renderTableBody(
                    loadingSections.rechargeSummary,
                    rechargeTypeChartData.length > 0,
                    4,
                    <>
                      {rechargeTypeChartData.map((item) => (
                        <tr key={item.orderType}>
                          <td>{item.label}</td>
                          <td>{item.userCount}</td>
                          <td>{item.orderCount}</td>
                          <td>{formatCurrency(item.totalAmount)}</td>
                        </tr>
                      ))}
                    </>,
                  )}
                </tbody>
              </table>
            </div>
          </section>
    </div>
  );
};

export default OperatorReports;
