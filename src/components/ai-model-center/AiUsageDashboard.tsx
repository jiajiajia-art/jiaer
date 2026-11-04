import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ColumnsType } from 'antd/es/table';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import aiModelCenterApi, {
  type AiBillingUsageAttempt,
  type AiBillingUsageFilters,
  type AiBillingUsageRow,
  type AiBillingUsageSummary,
} from '../../api/operator/aiModelCenterApi';
import {
  formatKkMinor,
  formatModelPriceX10000,
  formatMicroYuan,
  formatPoints,
  resolveUsagePresetRange,
  type UsagePreset,
} from '../../lib/aiUsageFormatting';
import { getApiErrorMessage } from '../../utils/error';
import styles from './AiUsageDashboard.module.css';
import { groupTxtDocParseAttempts, type AiBillingUsageDisplayRow } from '../../lib/groupTxtDocParseAttempts';

type PeriodPreset = UsagePreset | 'custom';
type PageSize = 10 | 20 | 50 | 100;
type BilledToUserFilter = '' | NonNullable<AiBillingUsageFilters['billedToUser']>;
type CurrencyTypeFilter = '' | NonNullable<AiBillingUsageFilters['currencyType']>;
type AggregateSortBy = 'calls' | 'charge' | 'cost';
type AggregateSortOrder = 'ascend' | 'descend';

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 20, 50, 100];
const DEFAULT_FILTERS = resolveUsagePresetRange('7d');
const EMPTY_SUMMARY: AiBillingUsageSummary = {
  overview: {
    totalCalls: 0,
    succeededCalls: 0,
    failedCalls: 0,
    incompleteCalls: 0,
    cancelledCalls: 0,
    startedCalls: 0,
    platformCostMicroYuan: 0,
    unbilledPlatformCostMicroYuan: 0,
    billedPoints: 0,
    billedKkMinor: 0,
  },
  trend: [],
  modelRanking: [],
  items: [],
  aggregatePagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
};

const statusLabels: Record<string, string> = {
  started: '进行中',
  succeeded: '成功',
  failed: '失败',
  incomplete: '未完整交付',
  cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  started: 'processing',
  succeeded: 'success',
  failed: 'error',
  incomplete: 'warning',
  cancelled: 'default',
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => (
  <Tag color={statusColors[status] || 'default'}>{statusLabels[status] || status}</Tag>
);

const chargeText = (currencyType: 'points' | 'kk', units: number) => (
  currencyType === 'points'
    ? `${formatPoints(units)} 织梦豆`
    : `${formatKkMinor(units)} KK币`
);

const AttemptPageSizeSelect: React.FC<{
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  className: string;
}> = ({ value, onChange, disabled, className }) => (
  <Select<number>
    aria-label="每页条数"
    className={className}
    value={value}
    disabled={disabled}
    options={PAGE_SIZE_OPTIONS.map((size) => ({ label: `${size} 条/页`, value: size }))}
    onChange={onChange}
  />
);

const AiUsageDashboard: React.FC = () => {
  const [period, setPeriod] = useState<PeriodPreset>('7d');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [userKeyword, setUserKeyword] = useState('');
  const [gameKeyword, setGameKeyword] = useState('');
  const [modelId, setModelId] = useState('');
  const [status, setStatus] = useState('');
  const [billedToUser, setBilledToUser] = useState<BilledToUserFilter>('');
  const [currencyType, setCurrencyType] = useState<CurrencyTypeFilter>('');
  const [aggregatePeriod, setAggregatePeriod] = useState<PeriodPreset>('7d');
  const [aggregateCustomRange, setAggregateCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [aggregateGameKeyword, setAggregateGameKeyword] = useState('');
  const [aggregatePage, setAggregatePage] = useState(1);
  const [aggregatePageSize, setAggregatePageSize] = useState<10>(10);
  const [aggregateSortBy, setAggregateSortBy] = useState<AggregateSortBy>('calls');
  const [aggregateSortOrder, setAggregateSortOrder] = useState<AggregateSortOrder>('descend');
  const [appliedFilters, setAppliedFilters] = useState<AiBillingUsageFilters>(DEFAULT_FILTERS);
  const [summary, setSummary] = useState<AiBillingUsageSummary>(EMPTY_SUMMARY);
  const [attempts, setAttempts] = useState<AiBillingUsageAttempt[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 as PageSize, total: 0 });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [aggregateError, setAggregateError] = useState('');
  const [attemptError, setAttemptError] = useState('');

  const loadSummary = useCallback(async (filters: AiBillingUsageFilters) => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const response = await aiModelCenterApi.listUsage(filters);
      setSummary(response.data.data || EMPTY_SUMMARY);
    } catch (requestError) {
      setSummaryError(getApiErrorMessage(requestError, '用量汇总加载失败'));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadAttempts = useCallback(async (
    filters: AiBillingUsageFilters,
    page: number,
    pageSize: PageSize,
  ) => {
    setAttemptLoading(true);
    setAttemptError('');
    try {
      const response = await aiModelCenterApi.listUsageAttempts({ ...filters, page, pageSize });
      const data = response.data.data;
      setAttempts(data?.items || []);
      setPagination({
        page: data?.pagination.page || page,
        pageSize: data?.pagination.pageSize || pageSize,
        total: data?.pagination.total || 0,
      });
    } catch (requestError) {
      setAttemptError(getApiErrorMessage(requestError, '调用明细加载失败'));
    } finally {
      setAttemptLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSummary({
      ...DEFAULT_FILTERS,
      aggregateFrom: DEFAULT_FILTERS.from,
      aggregateTo: DEFAULT_FILTERS.to,
      aggregatePage: 1,
      aggregatePageSize: 10,
    });
    void loadAttempts(DEFAULT_FILTERS, 1, 10);
  }, [loadAttempts, loadSummary]);

  const resolveDraftFilters = useCallback((): AiBillingUsageFilters | null => {
    const timeRange = period === 'custom' ? customRange : resolveUsagePresetRange(period);
    if (!timeRange) return null;
    return {
      ...timeRange,
      userKeyword: userKeyword.trim() || undefined,
      gameKeyword: gameKeyword.trim() || undefined,
      modelId: modelId.trim() || undefined,
      status: status || undefined,
      billedToUser: billedToUser || undefined,
      currencyType: currencyType || undefined,
    };
  }, [billedToUser, currencyType, customRange, gameKeyword, modelId, period, status, userKeyword]);

  const resolveAggregateFilters = useCallback((page = aggregatePage, pageSize = aggregatePageSize, sortBy = aggregateSortBy, sortOrder = aggregateSortOrder): AiBillingUsageFilters | null => {
    const timeRange = aggregatePeriod === 'custom'
      ? aggregateCustomRange
      : resolveUsagePresetRange(aggregatePeriod);
    if (!timeRange) return null;
    return {
      ...DEFAULT_FILTERS,
      aggregateFrom: timeRange.from,
      aggregateTo: timeRange.to,
      aggregateGameKeyword: aggregateGameKeyword.trim() || undefined,
      aggregatePage: page,
      aggregatePageSize: pageSize,
      aggregateSortBy: sortBy,
      aggregateSortOrder: sortOrder,
    };
  }, [aggregateCustomRange, aggregateGameKeyword, aggregatePage, aggregatePageSize, aggregatePeriod, aggregateSortBy, aggregateSortOrder]);

  const queryAggregate = useCallback((page = 1, pageSize = aggregatePageSize, sortBy = aggregateSortBy, sortOrder = aggregateSortOrder) => {
    const filters = resolveAggregateFilters(page, pageSize, sortBy, sortOrder);
    if (!filters || aggregateLoading) return;
    setAggregatePage(page);
    setAggregatePageSize(pageSize);
    setAggregateLoading(true);
    setAggregateError('');
    void aiModelCenterApi.listUsage(filters).then((response) => {
      const data = response.data.data;
      setSummary((current) => ({
        ...current,
        items: data?.items || [],
        aggregatePagination: data?.aggregatePagination || EMPTY_SUMMARY.aggregatePagination,
      }));
    }).catch((requestError) => {
      setAggregateError(getApiErrorMessage(requestError, '聚合统计加载失败'));
    }).finally(() => setAggregateLoading(false));
  }, [aggregateLoading, aggregatePageSize, aggregateSortBy, aggregateSortOrder, resolveAggregateFilters]);

  const query = useCallback(() => {
    const filters = resolveDraftFilters();
    if (!filters || attemptLoading) return;
    setAppliedFilters(filters);
    setPagination((current) => ({ ...current, page: 1 }));
    void loadAttempts(filters, 1, pagination.pageSize);
  }, [attemptLoading, loadAttempts, pagination.pageSize, resolveDraftFilters]);

  const refresh = useCallback(() => {
    if (attemptLoading) return;
    void loadAttempts(appliedFilters, pagination.page, pagination.pageSize);
  }, [appliedFilters, attemptLoading, loadAttempts, pagination]);

  const changePage = useCallback((page: number, nextPageSize: number) => {
    const pageSize = PAGE_SIZE_OPTIONS.includes(nextPageSize as PageSize)
      ? nextPageSize as PageSize
      : 10;
    const nextPage = pageSize === pagination.pageSize ? page : 1;
    setPagination((current) => ({ ...current, page: nextPage, pageSize }));
    void loadAttempts(appliedFilters, nextPage, pageSize);
  }, [appliedFilters, loadAttempts, pagination.pageSize]);

  const overview = summary.overview;
  const unsuccessfulCalls = overview.failedCalls + overview.incompleteCalls + overview.cancelledCalls;
  const successRate = overview.totalCalls > 0
    ? (overview.succeededCalls / overview.totalCalls) * 100
    : 0;
  const trendData = useMemo(() => summary.trend.map((row) => ({
    ...row,
    platformCostYuan: Number(formatMicroYuan(row.platformCostMicroYuan)),
  })), [summary.trend]);
  const callRanking = useMemo(() => [...summary.modelRanking]
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 8)
    .map((row) => ({ ...row, name: row.modelId })), [summary.modelRanking]);
  const costRanking = useMemo(() => [...summary.modelRanking]
    .sort((a, b) => b.platformCostMicroYuan - a.platformCostMicroYuan)
    .slice(0, 8)
    .map((row) => ({
      ...row,
      name: row.modelId,
      platformCostYuan: Number(formatMicroYuan(row.platformCostMicroYuan)),
    })), [summary.modelRanking]);
  const displayAttempts = useMemo(() => groupTxtDocParseAttempts(attempts), [attempts]);
  const modelOptions = useMemo(() => Array.from(new Set([
    ...summary.modelRanking.map((row) => row.modelId),
    modelId,
  ].filter(Boolean))).sort().map((value) => ({ label: value, value })), [modelId, summary.modelRanking]);

  const aggregateColumns: ColumnsType<AiBillingUsageRow> = [
    { title: '作品', dataIndex: 'gameTitle', key: 'gameTitle', render: (value) => value || '未关联作品' },
    {
      title: '来源 / 模型',
      key: 'model',
      render: (_, row) => <div className={styles.cellStack}><strong>{row.modelId}</strong><span>{row.platformSource} · {row.gatewayRoute}</span></div>,
    },
    {
      title: '状态 / 调用',
      key: 'status',
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: aggregateSortBy === 'calls' ? aggregateSortOrder : null,
      render: (_, row) => <div className={styles.cellStack}>
        <strong>{formatPoints(row.callCount)} 次调用</strong>
        <span>{[
          row.statusCounts?.succeeded ? `成功 ${formatPoints(row.statusCounts.succeeded)}` : null,
          row.statusCounts?.failed ? `失败 ${formatPoints(row.statusCounts.failed)}` : null,
          row.statusCounts?.incomplete ? `未完整交付 ${formatPoints(row.statusCounts.incomplete)}` : null,
          row.statusCounts?.cancelled ? `已取消 ${formatPoints(row.statusCounts.cancelled)}` : null,
          row.statusCounts?.started ? `进行中 ${formatPoints(row.statusCounts.started)}` : null,
        ].filter(Boolean).join(' · ') || '暂无调用'}</span>
      </div>,
    },
    {
      title: 'Token',
      key: 'tokens',
      render: (_, row) => <div className={styles.cellStack}><span>输入 {formatPoints(row.inputTokens)} / 输出 {formatPoints(row.outputTokens)}</span><span>缓存 {formatPoints(row.cachedInputTokens)}</span></div>,
    },
    {
      title: '平台成本',
      dataIndex: 'platformCostMicroYuan',
      key: 'platformCostMicroYuan',
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: aggregateSortBy === 'cost' ? aggregateSortOrder : null,
      render: (value) => `¥ ${formatMicroYuan(value)}`,
    },
    {
      title: '用户实际扣费',
      key: 'billedUnits',
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      sortOrder: aggregateSortBy === 'charge' ? aggregateSortOrder : null,
      render: (_, row) => <div className={styles.cellStack}>
        <span>{chargeText(row.currencyType, row.billedUnits)}</span>
      </div>,
    },
  ];

  const attemptColumns: ColumnsType<AiBillingUsageDisplayRow> = [
    {
      title: '用户',
      key: 'user',
      width: 190,
      render: (_, row) => <div className={styles.cellStack}>
        <strong>{row.userNickname || row.userCode || row.userId || '未知用户'}</strong>
        <span>{row.userCode && row.userCode !== row.userNickname ? row.userCode : '未关联账号'}</span>
      </div>,
    },
    {
      title: '游戏名',
      key: 'game',
      width: 190,
      render: (_, row) => <div className={styles.cellStack}>
        <strong>{row.gameTitle || '未关联游戏'}</strong>
      </div>,
    },
    {
      title: '模型',
      key: 'model',
      width: 210,
      render: (_, row) => <div className={styles.cellStack}>
        <strong>{row.modelId}</strong>
        <span>{row.isTxtDocParseSummary
          ? `txt_doc_parse · ${row.gatewayRoute} · ${row.attemptCount} 次调用汇总`
          : `${row.platformSource} · ${row.gatewayRoute} · 第 ${row.attemptNo} 次`}</span>
      </div>,
    },
    {
      title: '模型单价 / 消耗',
      key: 'modelUsage',
      width: 300,
      render: (_, row) => row.imageCount > 0
        ? <div className={styles.cellStack}>
          <strong>{row.imageAspectRatio || '未记录比例'} 档位</strong>
          <span>成本 {formatModelPriceX10000(row.imageUpstreamCostYuanX10000)} 元 / 张 · 基础价 {formatModelPriceX10000(row.imageUserBasePriceKkX10000)} KK币 / 张</span>
          <span>消耗 {formatPoints(row.imageCount)} 张</span>
        </div>
        : <div className={styles.cellStack}>
          <strong>Token 单价（元 / 百万 Token）</strong>
          <span>输入 {formatModelPriceX10000(row.inputPriceX10000)} · 输出 {formatModelPriceX10000(row.outputPriceX10000)} · 缓存 {formatModelPriceX10000(row.cachedInputPriceX10000)}</span>
          <span>消耗：输入 {formatPoints(row.inputTokens)} · 输出 {formatPoints(row.outputTokens)} · 缓存 {formatPoints(row.cachedInputTokens)}</span>
        </div>,
    },
    {
      title: '消耗的 KK币/织梦豆',
      key: 'userCharge',
      width: 150,
      render: (_, row) => row.billedToUser
        ? <strong>{chargeText(row.currencyType, row.allocatedUnits)}</strong>
        : <span className={styles.muted}>未实际扣费</span>,
    },
    {
      title: '平台成本',
      dataIndex: 'platformCostMicroYuan',
      key: 'platformCostMicroYuan',
      width: 140,
      render: (value) => `¥ ${formatMicroYuan(value)}`,
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, row) => <div className={`${styles.cellStack} ${styles.statusStack}`}>
        <StatusTag status={row.status} />
        {row.failureCode ? <span className={styles.statusDetail} title={`${row.failureCode} · ${row.failureMessage || '无失败详情'}`}>{row.failureCode} · {row.failureMessage || '无失败详情'}</span> : null}
      </div>,
    },
    {
      title: '订单时间',
      key: 'orderTime',
      width: 190,
      render: (_, row) => <div className={styles.cellStack}>
        <strong>{new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false })}</strong>
        <span>{row.finishedAt
          ? `完成 ${new Date(row.finishedAt).toLocaleString('zh-CN', { hour12: false })}`
          : '尚未完成'}</span>
      </div>,
    },
  ];

  return <ConfigProvider locale={zhCN} theme={{
    token: {
      colorPrimary: '#654bd6',
      colorInfo: '#654bd6',
      borderRadius: 10,
      controlHeightLG: 44,
    },
  }}>
    <div className={styles.root}>
      {summaryError ? <Alert type="error" showIcon message={summaryError} action={<Button onClick={() => void loadSummary(DEFAULT_FILTERS)}>重试汇总</Button>} /> : null}
      <Spin spinning={summaryLoading}>
        <section aria-label="用量总览" className={styles.section}>
          <div className={styles.sectionTitle}><h3>总览</h3><span>默认近 7 天的所有上游调用尝试</span></div>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}><Card className={styles.metric}><Statistic title="总调用次数" value={overview.totalCalls} /></Card></Col>
            <Col xs={24} sm={12} xl={6}><Card className={styles.metric}><Statistic title="成功率" value={successRate} precision={1} suffix="%" /></Card></Col>
            <Col xs={24} sm={12} xl={6}><Card className={styles.metric}><Statistic title="失败 / 未完整交付 / 取消" value={unsuccessfulCalls} /></Card></Col>
            <Col xs={24} sm={12} xl={6}><Card className={styles.metric}><Statistic title="平台总成本" value={formatMicroYuan(overview.platformCostMicroYuan)} prefix="¥" /></Card></Col>
            <Col xs={24} sm={12} xl={8}><Card className={styles.metric}><Statistic title="用户实际扣除织梦豆" value={formatPoints(overview.billedPoints)} suffix="织梦豆" /></Card></Col>
            <Col xs={24} sm={12} xl={8}><Card className={styles.metric}><Statistic title="用户实际扣除 KK币" value={formatKkMinor(overview.billedKkMinor)} suffix="KK币" /></Card></Col>
            <Col xs={24} sm={12} xl={8}><Card className={`${styles.metric} ${styles.warningMetric}`}><Statistic title="已产生成本但未向用户扣费" value={formatMicroYuan(overview.unbilledPlatformCostMicroYuan)} prefix="¥" /></Card></Col>
          </Row>
        </section>

        <section className={styles.chartGrid}>
          <Card title="调用量与平台成本趋势" className={styles.chartCard}>
            {trendData.length ? <div role="img" aria-label="按日期展示调用次数和平台成本趋势" className={styles.chart}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebf2" />
                  <XAxis dataKey="date" tick={{ fill: '#667085', fontSize: 12 }} />
                  <YAxis yAxisId="calls" allowDecimals={false} tick={{ fill: '#667085', fontSize: 12 }} />
                  <YAxis yAxisId="cost" orientation="right" tick={{ fill: '#667085', fontSize: 12 }} />
                  <ChartTooltip />
                  <Legend />
                  <Line isAnimationActive={false} yAxisId="calls" type="monotone" dataKey="callCount" name="调用次数" stroke="#654bd6" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line isAnimationActive={false} yAxisId="cost" type="monotone" dataKey="platformCostYuan" name="平台成本（元）" stroke="#e0783f" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div> : <Empty description="暂无趋势数据" />}
          </Card>
          <Card title="模型调用排行" className={styles.chartCard}>
            {callRanking.length ? <div role="img" aria-label="按模型展示调用次数排行" className={styles.chart}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={callRanking} layout="vertical" margin={{ top: 8, right: 12, left: 28, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebf2" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={108} tick={{ fill: '#475467', fontSize: 12 }} />
                  <ChartTooltip />
                  <Bar isAnimationActive={false} dataKey="callCount" name="调用次数" fill="#654bd6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <Empty description="暂无排行数据" />}
          </Card>
          <Card title="模型成本排行" className={styles.chartCard}>
            {costRanking.length ? <div role="img" aria-label="按模型展示平台成本排行" className={styles.chart}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={costRanking} layout="vertical" margin={{ top: 8, right: 12, left: 28, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebf2" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={108} tick={{ fill: '#475467', fontSize: 12 }} />
                  <ChartTooltip />
                  <Bar isAnimationActive={false} dataKey="platformCostYuan" name="平台成本（元）" fill="#e0783f" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <Empty description="暂无排行数据" />}
          </Card>
        </section>

        <Card title="聚合筛选" className={`${styles.filterCard} ${styles.aggregateFilterCard}`}>
          <div className={`${styles.filters} ${styles.aggregateFilters}`}>
            <label className={`${styles.field} ${styles.timeField}`}><span>聚合时间</span><Segmented<PeriodPreset>
              block
              size="middle"
              value={aggregatePeriod}
              onChange={(value) => setAggregatePeriod(value)}
              options={[
                { label: '今日', value: 'today' },
                { label: '近 7 天', value: '7d' },
                { label: '近 30 天', value: '30d' },
                { label: '自定义', value: 'custom' },
              ]}
            /></label>
            {aggregatePeriod === 'custom' ? <label className={`${styles.field} ${styles.timeField}`}><span>自定义范围</span><DatePicker.RangePicker
              size="middle"
              showTime
              allowClear
              onChange={(dates) => setAggregateCustomRange(dates?.[0] && dates?.[1] ? {
                from: dates[0].toISOString(),
                to: dates[1].toISOString(),
              } : null)}
            /></label> : null}
            <label className={styles.field}><span>作品</span><Input
              size="middle"
              allowClear
              value={aggregateGameKeyword}
              onChange={(event) => setAggregateGameKeyword(event.target.value)}
              onPressEnter={() => queryAggregate(1)}
              placeholder="输入作品名"
            /></label>
            <Button
              type="primary"
              size="middle"
              className={styles.queryButton}
              onClick={() => queryAggregate(1)}
              loading={aggregateLoading}
              disabled={aggregatePeriod === 'custom' && !aggregateCustomRange}
            >查询聚合</Button>
          </div>
        </Card>

        <Card title="聚合统计" className={styles.tableCard}>
          {aggregateError ? <Alert type="error" showIcon message={aggregateError} action={<Button onClick={() => queryAggregate(aggregatePage)}>重试聚合</Button>} /> : null}
          <Table<AiBillingUsageRow>
            rowKey={(row) => `${row.fileId || 'none'}-${row.platformSource}-${row.gatewayRoute}-${row.modelId}-${row.currencyType}`}
            columns={aggregateColumns}
            dataSource={summary.items}
            loading={aggregateLoading}
            pagination={{
              current: summary.aggregatePagination.page,
              pageSize: summary.aggregatePagination.pageSize,
              total: summary.aggregatePagination.total,
              showSizeChanger: false,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={(paginationState, _filters, sorter) => {
              const size = 10;
              const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
              const sortBy: AggregateSortBy = activeSorter?.columnKey === 'platformCostMicroYuan'
                ? 'cost'
                : activeSorter?.columnKey === 'billedUnits'
                  ? 'charge'
                  : 'calls';
              const sortOrder: AggregateSortOrder = activeSorter?.order === 'ascend' ? 'ascend' : 'descend';
              const sortChanged = sortBy !== aggregateSortBy || sortOrder !== aggregateSortOrder;
              setAggregateSortBy(sortBy);
              setAggregateSortOrder(sortOrder);
              queryAggregate(sortChanged ? 1 : paginationState.current || 1, size, sortBy, sortOrder);
            }}
            scroll={{ x: 980 }}
            locale={{ emptyText: <Empty description="暂无符合条件的聚合数据" /> }}
          />
        </Card>
      </Spin>

      <Card className={styles.filterCard} bordered={false}>
        <div className={styles.sectionHead}>
          <div><h3>明细筛选</h3><p>仅影响下方调用明细；总览、趋势、排行和聚合统计保持默认近 7 天范围。</p></div>
          <Button onClick={refresh} loading={attemptLoading}>刷新明细</Button>
        </div>
        <div className={styles.filters}>
          <label className={`${styles.field} ${styles.timeField}`}><span>调用时间</span><Segmented<PeriodPreset>
            block
            size="middle"
            value={period}
            onChange={setPeriod}
            options={[
              { label: '今日', value: 'today' },
              { label: '近 7 天', value: '7d' },
              { label: '近 30 天', value: '30d' },
              { label: '自定义', value: 'custom' },
            ]}
          /></label>
          {period === 'custom' ? <label className={`${styles.field} ${styles.timeField}`}><span>自定义范围</span><DatePicker.RangePicker
            size="middle"
            showTime
            allowClear
            onChange={(dates) => setCustomRange(dates?.[0] && dates?.[1] ? {
              from: dates[0].toISOString(),
              to: dates[1].toISOString(),
            } : null)}
          /></label> : null}
          <label className={styles.field}><span>用户</span><Input size="middle" allowClear value={userKeyword} onChange={(event) => setUserKeyword(event.target.value)} placeholder="昵称 / userCode / userId" /></label>
          <label className={styles.field}><span>游戏</span><Input size="middle" allowClear value={gameKeyword} onChange={(event) => setGameKeyword(event.target.value)} placeholder="游戏名 / fileId" /></label>
          <label className={`${styles.field} ${styles.modelFilterField}`}><span>模型</span><Select
            size="middle"
            allowClear
            showSearch
            optionFilterProp="label"
            value={modelId || undefined}
            onChange={(value) => setModelId(value || '')}
            options={modelOptions}
            placeholder="全部模型"
          /></label>
          <label className={`${styles.field} ${styles.statusFilterField}`}><span>状态</span><Select size="middle" value={status} onChange={setStatus} options={[
            { label: '全部状态', value: '' },
            { label: '进行中', value: 'started' },
            { label: '成功', value: 'succeeded' },
            { label: '失败', value: 'failed' },
            { label: '未完整交付', value: 'incomplete' },
            { label: '已取消', value: 'cancelled' },
          ]} /></label>
          <label className={`${styles.field} ${styles.billedFilterField}`}><span>是否实际扣费</span><Select<BilledToUserFilter> size="middle" value={billedToUser} onChange={setBilledToUser} options={[
            { label: '全部', value: '' },
            { label: '已实际扣费', value: 'true' },
            { label: '未实际扣费', value: 'false' },
          ]} /></label>
          <label className={`${styles.field} ${styles.currencyFilterField}`}><span>币种</span><Select<CurrencyTypeFilter> size="middle" value={currencyType} onChange={setCurrencyType} options={[
            { label: '全部币种', value: '' },
            { label: 'KK币', value: 'kk' },
            { label: '织梦豆', value: 'points' },
          ]} /></label>
          <Button type="primary" className={`${styles.queryButton} ${styles.detailQueryButton}`} onClick={query} loading={attemptLoading} disabled={period === 'custom' && !customRange}>查询</Button>
        </div>
      </Card>

      {attemptError ? <Alert type="error" showIcon message={attemptError} action={<Button onClick={() => void loadAttempts(appliedFilters, pagination.page, pagination.pageSize)}>重试明细</Button>} /> : null}
      <Card title="调用明细" className={styles.tableCard} extra={<span className={styles.tableHint}>TXT 文档解析按任务汇总，其它调用按上游尝试展示 · 时间倒序</span>}>
        <Table<AiBillingUsageDisplayRow>
          rowKey="id"
          columns={attemptColumns}
          dataSource={displayAttempts}
          loading={attemptLoading}
          scroll={{ x: 1720 }}
          locale={{ emptyText: <Empty description="暂无符合条件的调用明细" /> }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showSizeChanger: true,
            components: { sizeChanger: AttemptPageSizeSelect },
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条上游记录，TXT 文档解析按任务汇总显示`,
            onChange: changePage,
          }}
        />
      </Card>
    </div>
  </ConfigProvider>;
};

export default AiUsageDashboard;
