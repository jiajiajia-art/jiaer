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
  type ActivityTrendsResponse,
  type ConsumptionTrendResponse,
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

const OperatorReports: React.FC = () => {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<ReportGranularity>('day');
  const [startDate, setStartDate] = useState(() => buildPresetRange(30).startDate);
  const [endDate, setEndDate] = useState(() => buildPresetRange(30).endDate);
  const [presetDays, setPresetDays] = useState<7 | 30>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [activityData, setActivityData] = useState<ActivityTrendsResponse | null>(null);
  const [registrationData, setRegistrationData] = useState<ActivityTrendsResponse | null>(null);
  const [consumptionData, setConsumptionData] = useState<ConsumptionTrendResponse | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUsersSummaryResponse | null>(null);

  const queryParams = useMemo(() => ({ granularity, startDate, endDate }), [granularity, startDate, endDate]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const [activityResp, registrationResp, consumptionResp, activeUsersResp] = await Promise.all([
        operatorReportsApi.getActivityTrends(queryParams),
        operatorReportsApi.getRegistrationTrend(queryParams),
        operatorReportsApi.getConsumptionTrend(queryParams),
        operatorReportsApi.getActiveUsersSummary({ startDate, endDate }),
      ]);

      if (activityResp.data.success) setActivityData(activityResp.data.data || null);
      if (registrationResp.data.success) setRegistrationData(registrationResp.data.data || null);
      if (consumptionResp.data.success) setConsumptionData(consumptionResp.data.data || null);
      if (activeUsersResp.data.success) setActiveUsers(activeUsersResp.data.data || null);
    } catch (error) {
      console.error('[OperatorReports] load failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [endDate, queryParams, startDate]);

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
        </>
      ) : null}
    </div>
  );
};

export default OperatorReports;
