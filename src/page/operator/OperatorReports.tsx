import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '../../api/stats/operatorReportsApi';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import metricStyles from '../../components/Admin/MetricSummary.module.css';
import PageSectionHeader from '../../components/Admin/PageSectionHeader';
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
  const [isLoading, setIsLoading] = useState(false);
  const [activityData, setActivityData] = useState<ActivityTrendsResponse | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationTrendResponse | null>(null);
  const [consumptionData, setConsumptionData] = useState<ConsumptionTrendResponse | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUsersSummaryResponse | null>(null);
  const [newUserRetention, setNewUserRetention] = useState<NewUserRetentionPoint[]>([]);
  const [activeUserRetention, setActiveUserRetention] = useState<ActiveUserRetentionPoint[]>([]);
  const [rechargeSummary, setRechargeSummary] = useState<RechargeSummaryResponse | null>(null);
  const [rechargeTrend, setRechargeTrend] = useState<RechargeTrendResponse | null>(null);

  const queryParams = useMemo(() => ({ granularity, startDate, endDate }), [granularity, startDate, endDate]);
  const retentionQueryParams = useMemo(
    () => ({ startDate, endDate, days: retentionDays }),
    [endDate, retentionDays, startDate],
  );

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        activityResp,
        registrationResp,
        consumptionResp,
        activeUsersResp,
        newUserRetentionResp,
        activeUserRetentionResp,
        rechargeSummaryResp,
        rechargeTrendResp,
      ] = await Promise.all([
        operatorReportsApi.getActivityTrends(queryParams),
        operatorReportsApi.getRegistrationTrend(queryParams),
        operatorReportsApi.getConsumptionTrend(queryParams),
        operatorReportsApi.getActiveUsersSummary({ startDate, endDate }),
        operatorReportsApi.getNewUserRetention(retentionQueryParams),
        operatorReportsApi.getActiveUserRetention(retentionQueryParams),
        operatorReportsApi.getRechargeSummary({ startDate, endDate }),
        operatorReportsApi.getRechargeTrend(queryParams),
      ]);

      if (activityResp.data.success) setActivityData(activityResp.data.data || null);
      if (registrationResp.data.success) setRegistrationData(registrationResp.data.data || null);
      if (consumptionResp.data.success) setConsumptionData(consumptionResp.data.data || null);
      if (activeUsersResp.data.success) setActiveUsers(activeUsersResp.data.data || null);
      if (newUserRetentionResp.data.success) setNewUserRetention(newUserRetentionResp.data.data || []);
      if (activeUserRetentionResp.data.success) setActiveUserRetention(activeUserRetentionResp.data.data || []);
      if (rechargeSummaryResp.data.success) setRechargeSummary(rechargeSummaryResp.data.data || null);
      if (rechargeTrendResp.data.success) setRechargeTrend(rechargeTrendResp.data.data || null);
    } catch (error) {
      console.error('[OperatorReports] load failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [endDate, queryParams, retentionQueryParams, startDate]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

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

      {isLoading ? <div className={styles.emptyState}>{t('creatorStats.loading')}</div> : null}

      {!isLoading ? (
        <>
          <div className={metricStyles.grid}>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.latestDau')}
                tip={t('operator.reports.dauTip')}
              />
              <div className={metricStyles.value}>{activeUsers?.latestDau ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.averageDau')}
                tip={t('operator.reports.averageDauTip')}
              />
              <div className={metricStyles.value}>{activeUsers?.averageDau ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <MetricTitleTip
                className={metricStyles.title}
                title={t('operator.reports.peakDau')}
                tip={t('operator.reports.peakDauTip')}
              />
              <div className={metricStyles.value}>{activeUsers?.peakDau ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.consumptionTotal')}</div>
              <div className={metricStyles.value}>{consumptionData?.summary.total ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.registrationTotal')}</div>
              <div className={metricStyles.value}>{registrationData?.summary.total ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.userTotalCount')}</div>
              <div className={metricStyles.value}>{registrationData?.summary.userTotalCount ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeAmountTotal')}</div>
              <div className={metricStyles.value}>{formatCurrency(rechargeSummary?.totalAmount)}</div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeOrdersTotal')}</div>
              <div className={metricStyles.value}>{rechargeSummary?.totalOrders ?? 0}</div>
            </div>
            <div className={metricStyles.card}>
              <div className={metricStyles.title}>{t('operator.reports.rechargeUsersTotal')}</div>
              <div className={metricStyles.value}>{rechargeSummary?.totalUsers ?? 0}</div>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.activityTitle')}</h2>
            <p className={styles.sectionHint}>{t('operator.reports.activityHint')}</p>
            <div className={styles.chartWrap}>
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
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.registrationTitle')}</h2>
            <p className={styles.sectionHint}>{t('operator.reports.registrationHint')}</p>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={registrationChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="registration" name={t('operator.reports.registrationLabel')} fill="#d29922" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.consumptionTitle')}</h2>
            <p className={styles.sectionHint}>
              {t('operator.reports.consumptionHint')}
              {granularity === 'month' && consumptionData?.summary.momGrowth != null
                ? ` ${t('operator.reports.latestMomGrowth', { value: formatPercent(consumptionData.summary.momGrowth) })}`
                : ''}
            </p>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumptionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name={t('operator.reports.consumptionLabel')} fill="#e8940f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.newUserRetentionTitle')}</h2>
            <p className={styles.sectionHint}>
              {t('operator.reports.newUserRetentionHint', {
                daysLabel: t(retentionDays === 1 ? 'operator.reports.retentionDay1' : 'operator.reports.retentionDay7'),
              })}
            </p>
            <div className={styles.chartWrap}>
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
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.activeUserRetentionTitle')}</h2>
            <p className={styles.sectionHint}>
              {t('operator.reports.activeUserRetentionHint', {
                daysLabel: t(retentionDays === 1 ? 'operator.reports.retentionDay1' : 'operator.reports.retentionDay7'),
              })}
            </p>
            <div className={styles.chartWrap}>
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
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.rechargeTrendTitle')}</h2>
            <p className={styles.sectionHint}>{t('operator.reports.rechargeTrendHint')}</p>
            <div className={styles.chartWrap}>
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
              </ResponsiveContainer>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('operator.reports.rechargeSummaryTitle')}</h2>
            <p className={styles.sectionHint}>{t('operator.reports.rechargeSummaryHint')}</p>

            <div className={styles.chartWrap}>
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
              </ResponsiveContainer>
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
                </tbody>
              </table>
            </div>

            <div className={styles.chartWrap}>
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
              </ResponsiveContainer>
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
                  {rechargeTypeChartData.map((item) => (
                    <tr key={item.orderType}>
                      <td>{item.label}</td>
                      <td>{item.userCount}</td>
                      <td>{item.orderCount}</td>
                      <td>{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default OperatorReports;
