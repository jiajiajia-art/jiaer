import { useEffect, useState } from 'react';
import {
  MdAdd,
  MdAutoAwesome,
  MdContentCopy,
  MdDiamond,
  MdExpandLess,
  MdExpandMore,
  MdPeople,
  MdReceiptLong,
  MdRefresh,
  MdSwapHoriz,
} from 'react-icons/md';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import Navbar from '../../components/Layout/Navbar';
import MobileBottomNav from '../../components/Layout/MobileBottomNav';
import Pagination from '../../components/Pagination';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  externalSdkApi,
  type CreateDeveloperAppResponse,
  type ExternalDeveloperAppAiTrace,
  type ExternalDeveloperAppDiamondLedgerEntry,
  type ExternalDeveloperAppDiamondLedgerSummary,
  type ExternalDeveloperAppRechargeOrder,
  type ExternalDeveloperAppRechargeSummary,
  type ExternalDeveloperFunloomUser,
  type ExternalDeveloperApp,
  type ExternalDeveloperAppUserLink,
} from '../../api/externalSdkApi';
import { getApiErrorMessage } from '../../utils/error';
import styles from './DeveloperExternalGames.module.css';

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(value)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getFunloomAccountLabel(user: ExternalDeveloperFunloomUser) {
  return user.nickname || user.userCode || user.maskedPhone || user.userId;
}

function formatPaymentAmount(value?: number | null) {
  if (value === undefined || value === null) return '-';
  return `¥${(Number(value) / 100).toFixed(2)}`;
}

function formatDiamondDelta(value?: number | null) {
  if (value === undefined || value === null) return '-';
  const numeric = Number(value);
  return numeric > 0 ? `+${numeric}` : `${numeric}`;
}

function formatUsage(usage?: Record<string, unknown> | null) {
  if (!usage) return '-';
  const totalTokens = usage.total_tokens ?? usage.totalTokens;
  if (typeof totalTokens === 'number') return `${totalTokens} tokens`;
  return Object.keys(usage).length > 0 ? '有记录' : '-';
}

function formatStatus(value?: string | null) {
  const status = String(value || '').trim();
  const labels: Record<string, string> = {
    active: '启用',
    created: '已创建',
    pending: '待支付',
    paid: '已支付',
    failed: '失败',
    expired: '已过期',
    succeeded: '成功',
    processing: '处理中',
  };
  return labels[status] || status || '-';
}

type DeveloperDataSection = 'userLinks' | 'rechargeOrders' | 'diamondLedger' | 'aiTraces';

const DATA_PAGE_SIZE = 10;

function getTotalPages(total: number, pageSize = DATA_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

function getPageFromOffset(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Number(limit) || DATA_PAGE_SIZE);
  return Math.floor(Math.max(0, Number(offset) || 0) / safeLimit) + 1;
}

function formatCurrencyChartValue(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `¥${numeric.toFixed(numeric >= 100 ? 0 : 2)}`;
}

function formatDiamondChartValue(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${numeric} KK币`;
}

function buildRechargeChartData(summary?: ExternalDeveloperAppRechargeSummary) {
  return (summary?.series ?? []).map((point) => ({
    date: point.date,
    amount: Number((Number(point.totalAmount || 0) / 100).toFixed(2)),
    orders: Number(point.orderCount || 0),
  }));
}

function buildDiamondChartData(summary?: ExternalDeveloperAppDiamondLedgerSummary) {
  return (summary?.series ?? []).map((point) => ({
    date: point.date,
    diamonds: Number(point.totalDiamonds || 0),
    entries: Number(point.entryCount || 0),
  }));
}

function formatRechargeTooltip(value: unknown, name: unknown): [string, string] {
  const label = String(name || '');
  if (label === '充值金额') {
    return [formatCurrencyChartValue(value), label];
  }
  return [String(value ?? '-'), label];
}

function formatDiamondTooltip(value: unknown, name: unknown): [string, string] {
  const label = String(name || '');
  if (label === '消耗 KK币') {
    return [formatDiamondChartValue(value), label];
  }
  return [String(value ?? '-'), label];
}

interface UserLinksState {
  loading: boolean;
  loaded: boolean;
  error: string;
  links: ExternalDeveloperAppUserLink[];
  total: number;
}

interface RechargeOrdersState {
  loading: boolean;
  loaded: boolean;
  error: string;
  orders: ExternalDeveloperAppRechargeOrder[];
  summary?: ExternalDeveloperAppRechargeSummary;
  total: number;
  page: number;
  pageSize: number;
}

interface DiamondLedgerState {
  loading: boolean;
  loaded: boolean;
  error: string;
  entries: ExternalDeveloperAppDiamondLedgerEntry[];
  summary?: ExternalDeveloperAppDiamondLedgerSummary;
  total: number;
  page: number;
  pageSize: number;
}

interface AiTracesState {
  loading: boolean;
  loaded: boolean;
  error: string;
  traces: ExternalDeveloperAppAiTrace[];
  total: number;
}

export default function DeveloperExternalGames() {
  const currentUser = useAuthStore((state) => state.user?.user);
  const [apps, setApps] = useState<ExternalDeveloperApp[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreateDeveloperAppResponse | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<DeveloperDataSection>('userLinks');
  const [linksByApp, setLinksByApp] = useState<Record<string, UserLinksState>>({});
  const [rechargeOrdersByApp, setRechargeOrdersByApp] = useState<Record<string, RechargeOrdersState>>({});
  const [diamondLedgerByApp, setDiamondLedgerByApp] = useState<Record<string, DiamondLedgerState>>({});
  const [aiTracesByApp, setAiTracesByApp] = useState<Record<string, AiTracesState>>({});
  const [transferAppId, setTransferAppId] = useState<string | null>(null);
  const [targetUserCode, setTargetUserCode] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferringAppId, setTransferringAppId] = useState<string | null>(null);
  const canTransferOwner = isAdminRole(currentUser?.role);

  const loadApps = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await externalSdkApi.listDeveloperApps();
      setApps(response.data.data?.apps ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, '外部游戏加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApps();
  }, []);

  const handleCreate = async () => {
    const appName = name.trim();
    if (!appName) {
      toast.error('请填写游戏名称');
      return;
    }

    setCreating(true);
    setError('');
    setCreated(null);
    try {
      const response = await externalSdkApi.createDeveloperApp({
        name: appName,
      });
      const result = response.data.data;
      setCreated(result);
      setApps((prev) => [result.app, ...prev.filter((item) => item.appId !== result.app.appId)]);
      setName('');
      toast.success('外部游戏已创建');
    } catch (err) {
      setError(getApiErrorMessage(err, '创建外部游戏失败，请稍后重试。'));
    } finally {
      setCreating(false);
    }
  };

  const loadUserLinks = async (appId: string) => {
    setLinksByApp((prev) => ({
      ...prev,
      [appId]: {
        loading: true,
        loaded: prev[appId]?.loaded ?? false,
        error: '',
        links: prev[appId]?.links ?? [],
        total: prev[appId]?.total ?? 0,
      },
    }));

    try {
      const response = await externalSdkApi.listDeveloperAppUserLinks(appId);
      const data = response.data.data;
      setLinksByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: true,
          error: '',
          links: data.links ?? [],
          total: data.total ?? 0,
        },
      }));
    } catch (err) {
      setLinksByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: prev[appId]?.loaded ?? false,
          error: getApiErrorMessage(err, '绑定用户加载失败，请稍后重试。'),
          links: prev[appId]?.links ?? [],
          total: prev[appId]?.total ?? 0,
        },
      }));
    }
  };

  const loadRechargeOrders = async (appId: string, page = 1) => {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const offset = (safePage - 1) * DATA_PAGE_SIZE;
    setRechargeOrdersByApp((prev) => ({
      ...prev,
      [appId]: {
        loading: true,
        loaded: prev[appId]?.loaded ?? false,
        error: '',
        orders: prev[appId]?.orders ?? [],
        summary: prev[appId]?.summary,
        total: prev[appId]?.total ?? 0,
        page: safePage,
        pageSize: DATA_PAGE_SIZE,
      },
    }));

    try {
      const response = await externalSdkApi.listDeveloperAppRechargeOrders(appId, {
        limit: DATA_PAGE_SIZE,
        offset,
      });
      const data = response.data.data;
      setRechargeOrdersByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: true,
          error: '',
          orders: data.orders ?? [],
          summary: data.summary,
          total: data.total ?? 0,
          page: getPageFromOffset(data.offset, data.limit),
          pageSize: data.limit || DATA_PAGE_SIZE,
        },
      }));
    } catch (err) {
      setRechargeOrdersByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: prev[appId]?.loaded ?? false,
          error: getApiErrorMessage(err, '充值订单加载失败，请稍后重试。'),
          orders: prev[appId]?.orders ?? [],
          summary: prev[appId]?.summary,
          total: prev[appId]?.total ?? 0,
          page: prev[appId]?.page ?? safePage,
          pageSize: prev[appId]?.pageSize ?? DATA_PAGE_SIZE,
        },
      }));
    }
  };

  const loadDiamondLedger = async (appId: string, page = 1) => {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const offset = (safePage - 1) * DATA_PAGE_SIZE;
    setDiamondLedgerByApp((prev) => ({
      ...prev,
      [appId]: {
        loading: true,
        loaded: prev[appId]?.loaded ?? false,
        error: '',
        entries: prev[appId]?.entries ?? [],
        summary: prev[appId]?.summary,
        total: prev[appId]?.total ?? 0,
        page: safePage,
        pageSize: DATA_PAGE_SIZE,
      },
    }));

    try {
      const response = await externalSdkApi.listDeveloperAppDiamondLedger(appId, {
        limit: DATA_PAGE_SIZE,
        offset,
      });
      const data = response.data.data;
      setDiamondLedgerByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: true,
          error: '',
          entries: data.entries ?? [],
          summary: data.summary,
          total: data.total ?? 0,
          page: getPageFromOffset(data.offset, data.limit),
          pageSize: data.limit || DATA_PAGE_SIZE,
        },
      }));
    } catch (err) {
      setDiamondLedgerByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: prev[appId]?.loaded ?? false,
          error: getApiErrorMessage(err, '扣钻流水加载失败，请稍后重试。'),
          entries: prev[appId]?.entries ?? [],
          summary: prev[appId]?.summary,
          total: prev[appId]?.total ?? 0,
          page: prev[appId]?.page ?? safePage,
          pageSize: prev[appId]?.pageSize ?? DATA_PAGE_SIZE,
        },
      }));
    }
  };

  const loadAiTraces = async (appId: string) => {
    setAiTracesByApp((prev) => ({
      ...prev,
      [appId]: {
        loading: true,
        loaded: prev[appId]?.loaded ?? false,
        error: '',
        traces: prev[appId]?.traces ?? [],
        total: prev[appId]?.total ?? 0,
      },
    }));

    try {
      const response = await externalSdkApi.listDeveloperAppAiTraces(appId);
      const data = response.data.data;
      setAiTracesByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: true,
          error: '',
          traces: data.traces ?? [],
          total: data.total ?? 0,
        },
      }));
    } catch (err) {
      setAiTracesByApp((prev) => ({
        ...prev,
        [appId]: {
          loading: false,
          loaded: prev[appId]?.loaded ?? false,
          error: getApiErrorMessage(err, 'AI trace 加载失败，请稍后重试。'),
          traces: prev[appId]?.traces ?? [],
          total: prev[appId]?.total ?? 0,
        },
      }));
    }
  };

  const loadSection = (appId: string, section: DeveloperDataSection) => {
    if (section === 'userLinks') {
      const state = linksByApp[appId];
      if (!state?.loaded && !state?.loading) void loadUserLinks(appId);
      return;
    }
    if (section === 'rechargeOrders') {
      const state = rechargeOrdersByApp[appId];
      if (!state?.loaded && !state?.loading) void loadRechargeOrders(appId);
      return;
    }
    if (section === 'diamondLedger') {
      const state = diamondLedgerByApp[appId];
      if (!state?.loaded && !state?.loading) void loadDiamondLedger(appId);
      return;
    }
    const state = aiTracesByApp[appId];
    if (!state?.loaded && !state?.loading) void loadAiTraces(appId);
  };

  const toggleSection = (appId: string, section: DeveloperDataSection) => {
    if (expandedAppId === appId && expandedSection === section) {
      setExpandedAppId(null);
      return;
    }

    setExpandedAppId(appId);
    setExpandedSection(section);
    loadSection(appId, section);
  };

  const openTransferPanel = (appId: string) => {
    setTransferAppId((prev) => (prev === appId ? null : appId));
    setTargetUserCode('');
    setTransferError('');
  };

  const handleTransferOwner = async (app: ExternalDeveloperApp) => {
    const nextUserCode = targetUserCode.trim();
    if (!nextUserCode) {
      toast.error('请填写目标 Kuran号');
      return;
    }

    const confirmed = window.confirm(`确认将「${app.name}」转移给 ${nextUserCode}？转移后这个外部游戏会从当前账号列表移除。`);
    if (!confirmed) return;

    setTransferringAppId(app.appId);
    setTransferError('');
    try {
      const response = await externalSdkApi.transferDeveloperAppOwner(app.appId, {
        targetUserCode: nextUserCode,
      });
      const result = response.data.data;
      setApps((prev) => {
        if (result.app.ownerUserId === currentUser?.userId) {
          return prev.map((item) => (item.appId === result.app.appId ? result.app : item));
        }
        return prev.filter((item) => item.appId !== result.app.appId);
      });
      setExpandedAppId((prev) => (prev === app.appId ? null : prev));
      setTransferAppId(null);
      setTargetUserCode('');
      toast.success(`已转移给 ${result.nextOwner.userCode || nextUserCode}`);
    } catch (err) {
      setTransferError(getApiErrorMessage(err, '转移归属失败，请确认 Kuran号是否正确。'));
    } finally {
      setTransferringAppId(null);
    }
  };

  const copyText = async (label: string, value: string) => {
    try {
      await copyTextToClipboard(value);
      toast.success(`${label}已复制`);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const renderDataPagination = (
    state: { loading: boolean; loaded: boolean; total: number; page: number; pageSize: number } | undefined,
    onPageChange: (page: number) => void,
  ) => {
    if (!state?.loaded || state.total <= 0) return null;
    const totalPages = getTotalPages(state.total, state.pageSize);

    return (
      <div className={styles.dataPagination}>
        <span>
          第 {state.page} / {totalPages} 页，共 {state.total} 条，每页 {state.pageSize} 条
        </span>
        <Pagination
          className={styles.paginationControl}
          currentPage={state.page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          disabled={state.loading}
          maxVisiblePages={5}
          summary={null}
        />
      </div>
    );
  };

  const renderRechargeOverview = (state: RechargeOrdersState | undefined) => {
    if (!state?.loaded || state.error) return null;
    const summary = state.summary;
    const chartData = buildRechargeChartData(summary);

    return (
      <div className={styles.dataOverview}>
        <div className={styles.metricStrip}>
          <div className={styles.metricItem}>
            <span>已支付金额</span>
            <strong>{formatPaymentAmount(summary?.totalAmount ?? 0)}</strong>
          </div>
          <div className={styles.metricItem}>
            <span>已支付订单</span>
            <strong>{summary?.orderCount ?? 0}</strong>
          </div>
        </div>
        <div className={styles.chartPanel} aria-label="已支付充值金额趋势">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e7edf5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#69778c' }} tickMargin={8} />
                <YAxis tick={{ fontSize: 12, fill: '#69778c' }} tickFormatter={formatCurrencyChartValue} width={56} />
                <Tooltip formatter={formatRechargeTooltip} labelFormatter={(label) => `日期 ${label}`} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="充值金额"
                  stroke="#2f81f7"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.chartEmpty}>暂无已支付充值趋势</div>
          )}
        </div>
      </div>
    );
  };

  const renderDiamondOverview = (state: DiamondLedgerState | undefined) => {
    if (!state?.loaded || state.error) return null;
    const summary = state.summary;
    const chartData = buildDiamondChartData(summary);

    return (
      <div className={styles.dataOverview}>
        <div className={styles.metricStrip}>
          <div className={styles.metricItem}>
            <span>成功消耗 KK币</span>
            <strong>{summary?.totalDiamonds ?? 0}</strong>
          </div>
          <div className={styles.metricItem}>
            <span>成功扣钻笔数</span>
            <strong>{summary?.entryCount ?? 0}</strong>
          </div>
        </div>
        <div className={styles.chartPanel} aria-label="成功扣钻趋势">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e7edf5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#69778c' }} tickMargin={8} />
                <YAxis tick={{ fontSize: 12, fill: '#69778c' }} tickFormatter={formatDiamondChartValue} width={70} />
                <Tooltip formatter={formatDiamondTooltip} labelFormatter={(label) => `日期 ${label}`} />
                <Line
                  type="monotone"
                  dataKey="diamonds"
                  name="消耗 KK币"
                  stroke="#d29922"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.chartEmpty}>暂无成功扣钻趋势</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Developer Mode</p>
            <h1>我的外部游戏</h1>
            <p>
              管理你接入 Funloom 的外部游戏。这里展示应用、绑定、充值、扣钻和 AI 调用相关数据，不放进平台通用数据报表。
            </p>
          </div>
          <button type="button" className={styles.refreshButton} onClick={() => void loadApps()} disabled={loading}>
            <MdRefresh />
            刷新
          </button>
        </header>

        <div className={styles.contentGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>创建外部游戏</h2>
              <p>只需要填写游戏基础信息，授权回调等接入地址会按正式端默认规则生成。</p>
            </div>

            <div className={styles.createForm}>
              <label className={styles.field}>
                <span>游戏名称</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：xx模拟器,消消乐" />
              </label>

              <button type="button" className={styles.primaryButton} onClick={handleCreate} disabled={creating}>
                <MdAdd />
                {creating ? '创建中...' : '创建外部游戏'}
              </button>

              {created ? (
                <div className={styles.createdSecret}>
                  <p>密钥只展示这一次，请复制到你的服务端或 Cloudflare secret。</p>
                  <div className={styles.secretLine}>
                    <span>FUNLOOM_APP_ID</span>
                    <code>{created.app.appId}</code>
                  </div>
                  <div className={styles.secretLine}>
                    <span>FUNLOOM_APP_SECRET</span>
                    <code>{created.appSecret}</code>
                  </div>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => void copyText('接入配置', `FUNLOOM_APP_ID=${created.app.appId}\nFUNLOOM_APP_SECRET=${created.appSecret}`)}
                  >
                    <MdContentCopy />
                    复制接入配置
                  </button>
                </div>
              ) : (
                <p className={styles.notice}>创建后会显示一次密钥；之后页面只展示应用信息和该游戏自己的接入数据。</p>
              )}

              {error ? <p className={styles.error}>{error}</p> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>已创建的外部游戏</h2>
              <p>这里是开发者模式下属于你的外部游戏，不与运营中心的数据报表混放。</p>
            </div>

            <div className={styles.appList}>
              {loading ? <p className={styles.notice}>正在加载外部游戏...</p> : null}
              {!loading && apps.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>还没有外部游戏</strong>
                  <span>创建后可以在这里查看应用信息，后续会继续接入绑定、充值、扣钻和 AI trace 明细。</span>
                </div>
              ) : null}

              {apps.map((app) => {
                const userLinksState = linksByApp[app.appId];
                const rechargeState = rechargeOrdersByApp[app.appId];
                const diamondState = diamondLedgerByApp[app.appId];
                const traceState = aiTracesByApp[app.appId];
                const isUserLinksExpanded = expandedAppId === app.appId && expandedSection === 'userLinks';
                const isRechargeExpanded = expandedAppId === app.appId && expandedSection === 'rechargeOrders';
                const isDiamondExpanded = expandedAppId === app.appId && expandedSection === 'diamondLedger';
                const isAiTracesExpanded = expandedAppId === app.appId && expandedSection === 'aiTraces';

                return (
                  <article key={app.appId} className={styles.appCard}>
                    <div className={styles.appCardHeader}>
                      <h3 className={styles.appName}>{app.name}</h3>
                      <span className={styles.statusPill} data-status={app.status || 'active'}>
                        {app.status === 'inactive' ? '停用' : '启用'}
                      </span>
                    </div>

                    <div className={styles.metaGrid}>
                      <div className={styles.metaItem}>
                        <span>App ID</span>
                        <strong>{app.appId}</strong>
                      </div>
                      <div className={styles.metaItem}>
                        <span>创建时间</span>
                        <strong>{formatDate(app.createdAt)}</strong>
                      </div>
                    </div>

                    <div className={styles.dataLinks} aria-label="外部游戏数据">
                      <button
                        type="button"
                        className={styles.dataChipButton}
                        onClick={() => toggleSection(app.appId, 'userLinks')}
                        aria-expanded={isUserLinksExpanded}
                      >
                        <MdPeople />
                        绑定用户
                        {userLinksState?.loaded ? ` ${userLinksState.total}` : ''}
                        {isUserLinksExpanded ? <MdExpandLess /> : <MdExpandMore />}
                      </button>
                      <button
                        type="button"
                        className={styles.dataChipButton}
                        onClick={() => toggleSection(app.appId, 'rechargeOrders')}
                        aria-expanded={isRechargeExpanded}
                      >
                        <MdReceiptLong />
                        充值订单
                        {rechargeState?.loaded ? ` ${rechargeState.total}` : ''}
                        {isRechargeExpanded ? <MdExpandLess /> : <MdExpandMore />}
                      </button>
                      <button
                        type="button"
                        className={styles.dataChipButton}
                        onClick={() => toggleSection(app.appId, 'diamondLedger')}
                        aria-expanded={isDiamondExpanded}
                      >
                        <MdDiamond />
                        KK币消费
                        {diamondState?.loaded ? ` ${diamondState.total}` : ''}
                        {isDiamondExpanded ? <MdExpandLess /> : <MdExpandMore />}
                      </button>
                      <button
                        type="button"
                        className={styles.dataChipButton}
                        onClick={() => toggleSection(app.appId, 'aiTraces')}
                        aria-expanded={isAiTracesExpanded}
                      >
                        <MdAutoAwesome />
                        AI trace
                        {traceState?.loaded ? ` ${traceState.total}` : ''}
                        {isAiTracesExpanded ? <MdExpandLess /> : <MdExpandMore />}
                      </button>
                      {canTransferOwner ? (
                        <button
                          type="button"
                          className={styles.transferChipButton}
                          onClick={() => openTransferPanel(app.appId)}
                          aria-expanded={transferAppId === app.appId}
                        >
                          <MdSwapHoriz />
                          转移归属
                        </button>
                      ) : null}
                    </div>

                    {canTransferOwner && transferAppId === app.appId ? (
                      <div className={styles.transferPanel}>
                        <label className={styles.transferField}>
                          <span>目标 Kuran号</span>
                          <input
                            value={targetUserCode}
                            onChange={(event) => setTargetUserCode(event.target.value)}
                            placeholder="Kuran_..."
                          />
                        </label>
                        <div className={styles.transferActions}>
                          <button
                            type="button"
                            className={styles.transferConfirmButton}
                            onClick={() => void handleTransferOwner(app)}
                            disabled={transferringAppId === app.appId}
                          >
                            {transferringAppId === app.appId ? '转移中...' : '确认转移'}
                          </button>
                          <button
                            type="button"
                            className={styles.transferCancelButton}
                            onClick={() => openTransferPanel(app.appId)}
                            disabled={transferringAppId === app.appId}
                          >
                            取消
                          </button>
                        </div>
                        {transferError ? <p className={styles.error}>{transferError}</p> : null}
                      </div>
                    ) : null}

                    {isUserLinksExpanded ? (
                      <div className={styles.linksPanel}>
                        <div className={styles.linksPanelHeader}>
                          <strong>绑定用户</strong>
                          <button
                            type="button"
                            className={styles.miniButton}
                            onClick={() => void loadUserLinks(app.appId)}
                            disabled={userLinksState?.loading}
                          >
                            <MdRefresh />
                            刷新
                          </button>
                        </div>

                        {userLinksState?.loading ? <p className={styles.notice}>正在加载绑定用户...</p> : null}
                        {userLinksState?.error ? <p className={styles.error}>{userLinksState.error}</p> : null}
                        {userLinksState?.loaded && userLinksState.links.length === 0 ? (
                          <p className={styles.notice}>当前还没有用户绑定这个外部游戏。</p>
                        ) : null}

                        {userLinksState?.links.length ? (
                          <div className={styles.linkTable}>
                            <div className={styles.linkTableHead}>
                              <span>Funloom 账号</span>
                              <span>游戏用户 ID</span>
                              <span>状态</span>
                              <span>绑定时间</span>
                            </div>
                            {userLinksState.links.map((link) => (
                              <div key={`${link.appId}:${link.externalUserId}`} className={styles.linkRow}>
                                <div className={styles.accountCell}>
                                  <strong>{getFunloomAccountLabel(link.funloomUser)}</strong>
                                  <span>{link.funloomUser.userCode || link.funloomUser.maskedPhone || link.funloomUserId}</span>
                                </div>
                                <span>{link.externalUserId}</span>
                                <span>{link.status === 'active' ? '已绑定' : link.status}</span>
                                <span>{formatDateTime(link.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isRechargeExpanded ? (
                      <div className={styles.linksPanel}>
                        <div className={styles.linksPanelHeader}>
                          <div className={styles.sectionTitleBlock}>
                            <strong>已支付充值订单</strong>
                            <span>仅展示 Funloom 平台确认支付成功的外部游戏充值。</span>
                          </div>
                          <button
                            type="button"
                            className={styles.miniButton}
                            onClick={() => void loadRechargeOrders(app.appId, rechargeState?.page ?? 1)}
                            disabled={rechargeState?.loading}
                          >
                            <MdRefresh />
                            刷新
                          </button>
                        </div>

                        {rechargeState?.loading ? <p className={styles.notice}>正在加载充值订单...</p> : null}
                        {rechargeState?.error ? <p className={styles.error}>{rechargeState.error}</p> : null}
                        {rechargeState?.loaded && rechargeState.orders.length === 0 ? (
                          <p className={styles.notice}>当前还没有这个外部游戏的已支付充值订单。</p>
                        ) : null}

                        {renderRechargeOverview(rechargeState)}

                        {rechargeState?.orders.length ? (
                          <div className={styles.dataTable}>
                            <div className={`${styles.dataTableHead} ${styles.rechargeGrid}`}>
                              <span>Funloom 账号</span>
                              <span>游戏用户 ID</span>
                              <span>套餐/金额</span>
                              <span>状态</span>
                              <span>创建时间</span>
                            </div>
                            {rechargeState.orders.map((order) => (
                              <div key={order.sessionId} className={`${styles.dataRow} ${styles.rechargeGrid}`}>
                                <div className={styles.accountCell}>
                                  <strong>{getFunloomAccountLabel(order.funloomUser)}</strong>
                                  <span>{order.funloomUser.userCode || order.funloomUser.maskedPhone || order.funloomUserId}</span>
                                </div>
                                <span>{order.externalUserId || '-'}</span>
                                <div className={styles.amountCell}>
                                  <strong>{formatPaymentAmount(order.totalAmount)}</strong>
                                  <span>{order.planId || '-'}</span>
                                </div>
                                <span className={styles.statusText}>{formatStatus(order.paymentStatus || order.status)}</span>
                                <span>{formatDateTime(order.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {renderDataPagination(rechargeState, (page) => void loadRechargeOrders(app.appId, page))}
                      </div>
                    ) : null}

                    {isDiamondExpanded ? (
                      <div className={styles.linksPanel}>
                        <div className={styles.linksPanelHeader}>
                          <div className={styles.sectionTitleBlock}>
                            <strong>成功扣钻流水</strong>
                            <span>仅展示 Funloom 平台已成功扣除 KK币的外部游戏消耗。</span>
                          </div>
                          <button
                            type="button"
                            className={styles.miniButton}
                            onClick={() => void loadDiamondLedger(app.appId, diamondState?.page ?? 1)}
                            disabled={diamondState?.loading}
                          >
                            <MdRefresh />
                            刷新
                          </button>
                        </div>

                        {diamondState?.loading ? <p className={styles.notice}>正在加载扣钻流水...</p> : null}
                        {diamondState?.error ? <p className={styles.error}>{diamondState.error}</p> : null}
                        {diamondState?.loaded && diamondState.entries.length === 0 ? (
                          <p className={styles.notice}>当前还没有这个外部游戏的成功扣钻流水。</p>
                        ) : null}

                        {renderDiamondOverview(diamondState)}

                        {diamondState?.entries.length ? (
                          <div className={styles.dataTable}>
                            <div className={`${styles.dataTableHead} ${styles.ledgerGrid}`}>
                              <span>Funloom 账号</span>
                              <span>游戏用户 ID</span>
                              <span>扣钻</span>
                              <span>原因</span>
                              <span>状态</span>
                              <span>时间</span>
                            </div>
                            {diamondState.entries.map((entry) => (
                              <div key={entry.orderNo} className={`${styles.dataRow} ${styles.ledgerGrid}`}>
                                <div className={styles.accountCell}>
                                  <strong>{getFunloomAccountLabel(entry.funloomUser)}</strong>
                                  <span>{entry.funloomUser.userCode || entry.funloomUser.maskedPhone || entry.funloomUserId}</span>
                                </div>
                                <span>{entry.externalUserId || '-'}</span>
                                <strong className={styles.negativeAmount}>{formatDiamondDelta(entry.diamondDelta ?? -entry.amount)}</strong>
                                <span className={styles.monoCell}>{entry.reason || entry.orderType}</span>
                                <span className={styles.statusText}>{formatStatus(entry.status)}</span>
                                <span>{formatDateTime(entry.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {renderDataPagination(diamondState, (page) => void loadDiamondLedger(app.appId, page))}
                      </div>
                    ) : null}

                    {isAiTracesExpanded ? (
                      <div className={styles.linksPanel}>
                        <div className={styles.linksPanelHeader}>
                          <strong>AI trace</strong>
                          <button
                            type="button"
                            className={styles.miniButton}
                            onClick={() => void loadAiTraces(app.appId)}
                            disabled={traceState?.loading}
                          >
                            <MdRefresh />
                            刷新
                          </button>
                        </div>

                        {traceState?.loading ? <p className={styles.notice}>正在加载 AI trace...</p> : null}
                        {traceState?.error ? <p className={styles.error}>{traceState.error}</p> : null}
                        {traceState?.loaded && traceState.traces.length === 0 ? (
                          <p className={styles.notice}>当前还没有这个外部游戏的 AI 调用记录。</p>
                        ) : null}

                        {traceState?.traces.length ? (
                          <div className={styles.dataTable}>
                            <div className={`${styles.dataTableHead} ${styles.traceGrid}`}>
                              <span>Trace</span>
                              <span>用户</span>
                              <span>模型/场景</span>
                              <span>状态</span>
                              <span>预览</span>
                              <span>时间</span>
                            </div>
                            {traceState.traces.map((trace) => (
                              <div key={trace.traceId} className={`${styles.dataRow} ${styles.traceGrid}`}>
                                <span className={styles.monoCell}>{trace.traceId}</span>
                                <div className={styles.accountCell}>
                                  <strong>{getFunloomAccountLabel(trace.funloomUser)}</strong>
                                  <span>{trace.externalUserId || trace.funloomUser.userCode || trace.funloomUserId}</span>
                                </div>
                                <div className={styles.accountCell}>
                                  <strong>{trace.model || '-'}</strong>
                                  <span>{trace.sceneCode || '-'}</span>
                                </div>
                                <div className={styles.accountCell}>
                                  <strong>{formatStatus(trace.status)}</strong>
                                  <span>{formatUsage(trace.usage)}</span>
                                </div>
                                <span className={styles.previewCell}>{trace.responsePreview || trace.errorMessage || '-'}</span>
                                <span>{formatDateTime(trace.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
