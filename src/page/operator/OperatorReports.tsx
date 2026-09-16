import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
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
  type ConsumptionTrendResponse,
  type NewUserRetentionPoint,
  type RechargeSummaryResponse,
  type RechargeTrendResponse,
  type RegistrationTrendResponse,
  type ReportGranularity,
  type ReportPlatform,
} from '../../api/stats/operatorReportsApi';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import metricStyles from '../../components/Admin/MetricSummary.module.css';
import PageSectionHeader from '../../components/Admin/PageSectionHeader.tsx';
import styles from './OperatorReports.module.css';
import {
  buildPresetRange,
  formatPercent,
  mergeSeriesForChart,
} from '../../utils/operatorReportChart';

const ACTIVITY_COLORS: Record<string, string> = {
  submission: '#c9733f',
  pv: '#2f81f7',
  comment: '#23d18b',
  share: '#b15cff',
};

const RECHARGE_COLORS: Record<string, string> = {
  recharge: '#2f81f7',
  orders: '#d29922',
  users: '#23a26d',
};

const RETENTION_DAY_OPTIONS = [1, 7] as const;
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
  | 'rechargeSummary'
  | 'rechargeTrend';

const INITIAL_LOADING_STATE: Record<ReportSectionKey, boolean> = {
  activity: false,
  registration: false,
  consumption: false,
  activeUsers: false,
  newUserRetention: false,
  activeUserRetention: false,
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

const OperatorReports: React.FC = () => {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<ReportGranularity>('day');
  const [retentionDays, setRetentionDays] = useState<(typeof RETENTION_DAY_OPTIONS)[number]>(1);
  const [startDate, setStartDate] = useState(() => buildPresetRange(30).startDate);
  const [endDate, setEndDate] = useState(() => buildPresetRange(30).endDate);
  const [presetDays, setPresetDays] = useState<7 | 30>(30);
  const [activityData, setActivityData] = useState<ActivityTrendsResponse | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationTrendResponse | null>(null);
  const [consumptionData, setConsumptionData] = useState<ConsumptionTrendResponse | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUsersSummaryResponse | null>(null);
  const [newUserRetention, setNewUserRetention] = useState<NewUserRetentionPoint[]>([]);
  const [activeUserRetention, setActiveUserRetention] = useState<ActiveUserRetentionPoint[]>([]);
  const [rechargeSummary, setRechargeSummary] = useState<RechargeSummaryResponse | null>(null);
  const [rechargeTrend, setRechargeTrend] = useState<RechargeTrendResponse | null>(null);
  const [registrationPlatform, setRegistrationPlatform] = useState<ReportPlatform>('all');
  const [newUserRetentionPlatform, setNewUserRetentionPlatform] = useState<ReportPlatform>('all');
  const [activeUserRetentionPlatform, setActiveUserRetentionPlatform] = useState<ReportPlatform>('all');
  const [rechargeSummaryPlatform, setRechargeSummaryPlatform] = useState<ReportPlatform>('all');
  const [activityPlatform, setActivityPlatform] = useState<ReportPlatform>('all');
  const [consumptionPlatform, setConsumptionPlatform] = useState<ReportPlatform>('all');
  const [rechargeTrendPlatform, setRechargeTrendPlatform] = useState<ReportPlatform>('all');
  const [loadingSections, setLoadingSections] = useState<Record<ReportSectionKey, boolean>>(INITIAL_LOADING_STATE);
  const batchRequestIdRef = useRef(0);
  const registrationPlatformMountedRef = useRef(false);
  const activityPlatformMountedRef = useRef(false);
  const consumptionPlatformMountedRef = useRef(false);
  const newUserRetentionPlatformMountedRef = useRef(false);
  const activeUserRetentionPlatformMountedRef = useRef(false);
  const rechargeTrendPlatformMountedRef = useRef(false);
  const rechargeSummaryPlatformMountedRef = useRef(false);

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
      const resp = await operatorReportsApi.getActivityTrends({ ...queryParams, platform: activityPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setActivityData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] activity-trends failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('activity', false);
      }
    }
  }, [queryParams, activityPlatform, setSectionLoading]);

  // 注册用户增长（独立 platform）
  const loadRegistrationTrend = useCallback(async (requestId?: number) => {
    setSectionLoading('registration', true);
    try {
      const resp = await operatorReportsApi.getRegistrationTrend({ ...queryParams, platform: registrationPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setRegistrationData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] registrations/trend failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('registration', false);
      }
    }
  }, [queryParams, registrationPlatform, setSectionLoading]);

  // 积分消费趋势（独立 platform）
  const loadConsumptionTrend = useCallback(async (requestId?: number) => {
    setSectionLoading('consumption', true);
    try {
      const resp = await operatorReportsApi.getConsumptionTrend({ ...queryParams, platform: consumptionPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setConsumptionData(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] consumption/trend failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('consumption', false);
      }
    }
  }, [queryParams, consumptionPlatform, setSectionLoading]);

  // DAU 指标（无 platform，日期变化时重请求）
  const loadActiveUsersSummary = useCallback(async (requestId?: number) => {
    setSectionLoading('activeUsers', true);
    try {
      const resp = await operatorReportsApi.getActiveUsersSummary({ startDate, endDate });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setActiveUsers(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] active-users/summary failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('activeUsers', false);
      }
    }
  }, [startDate, endDate, setSectionLoading]);

  // 注册留存（独立 platform）
  const loadNewUserRetention = useCallback(async (requestId?: number) => {
    setSectionLoading('newUserRetention', true);
    try {
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
  }, [retentionQueryParams, newUserRetentionPlatform, setSectionLoading]);

  // 活跃留存（独立 platform）
  const loadActiveUserRetention = useCallback(async (requestId?: number) => {
    setSectionLoading('activeUserRetention', true);
    try {
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
  }, [retentionQueryParams, activeUserRetentionPlatform, setSectionLoading]);

  // 充值趋势（独立 platform）
  const loadRechargeTrend = useCallback(async (requestId?: number) => {
    setSectionLoading('rechargeTrend', true);
    try {
      const resp = await operatorReportsApi.getRechargeTrend({ ...queryParams, platform: rechargeTrendPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setRechargeTrend(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] recharge/trend failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('rechargeTrend', false);
      }
    }
  }, [queryParams, rechargeTrendPlatform, setSectionLoading]);

  // 充值汇总（独立 platform）
  const loadRechargeSummary = useCallback(async (requestId?: number) => {
    setSectionLoading('rechargeSummary', true);
    try {
      const resp = await operatorReportsApi.getRechargeSummary({ startDate, endDate, platform: rechargeSummaryPlatform });
      if (requestId != null && requestId !== batchRequestIdRef.current) return;
      if (resp.data.success) setRechargeSummary(resp.data.data || null);
    } catch (e) {
      console.error('[OperatorReports] recharge/summary failed', e);
    } finally {
      if (requestId == null || requestId === batchRequestIdRef.current) {
        setSectionLoading('rechargeSummary', false);
      }
    }
  }, [startDate, endDate, rechargeSummaryPlatform, setSectionLoading]);

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
      </div>

      <div className={metricStyles.grid}>
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
      </div>

          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.activityTitle')}</h2>
              <PlatformSelect value={activityPlatform} onChange={setActivityPlatform} />
            </div>
            <p className={styles.sectionHint}>{t('operator.reports.activityHint')}</p>
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
              <h2 className={styles.sectionTitle}>{t('operator.reports.registrationTitle')}</h2>
              <PlatformSelect value={registrationPlatform} onChange={setRegistrationPlatform} />
            </div>
            <p className={styles.sectionHint}>{t('operator.reports.registrationHint')}</p>
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
          </section>

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

          <section className={styles.section}>
            <div className={styles.sectionToolbar}>
              <h2 className={styles.sectionTitle}>{t('operator.reports.rechargeTrendTitle')}</h2>
              <PlatformSelect value={rechargeTrendPlatform} onChange={setRechargeTrendPlatform} />
            </div>
            <p className={styles.sectionHint}>{t('operator.reports.rechargeTrendHint')}</p>
            <div className={styles.chartWrap}>
              {renderChartContent(
                loadingSections.rechargeTrend,
                rechargeTrendChartData.length > 0,
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rechargeTrendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {(rechargeTrend?.series || []).map((series) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={t(`operator.reports.rechargeMetrics.${series.key}`, { defaultValue: series.label })}
                        stroke={RECHARGE_COLORS[series.key] || '#888'}
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
              <h2 className={styles.sectionTitle}>{t('operator.reports.rechargeSummaryTitle')}</h2>
              <PlatformSelect value={rechargeSummaryPlatform} onChange={setRechargeSummaryPlatform} />
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
