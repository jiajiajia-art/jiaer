import { getImageUrl } from './constants';
import {
  coverUrlAfterDisplayCoverError,
  toDisplayCoverUrl,
} from './displayCoverUrl';
import { shiftIsoDate, shanghaiTodayIso } from './operatorReportChart';

/** 功能注释：运营全站统计时间快捷（Asia/Shanghai），与计划书 §2.4 对齐 */
export type OperatorStatsPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'all'
  | 'custom';

export type OperatorSortBy =
  | 'pv'
  | 'uv'
  | 'playCount'
  | 'playDurationSeconds'
  | 'likeCount'
  | 'favoriteCount'
  | 'commentCount'
  | 'spendPoints'
  | 'spendKkMinor'
  | 'aiTokens';

export const OPERATOR_METRIC_KEYS: OperatorSortBy[] = [
  'pv',
  'uv',
  'playCount',
  'playDurationSeconds',
  'likeCount',
  'favoriteCount',
  'commentCount',
  'spendPoints',
  'spendKkMinor',
  'aiTokens',
];

export const OPERATOR_KPI_KEYS = OPERATOR_METRIC_KEYS;
export type OperatorKpiKey = OperatorSortBy;

const OPERATOR_METRIC_LABEL_KEYS: Record<OperatorKpiKey, string> = {
  pv: 'operator.siteStats.metricPv',
  uv: 'operator.siteStats.metricUv',
  playCount: 'operator.siteStats.metricPlayCount',
  playDurationSeconds: 'operator.siteStats.metricPlayDuration',
  likeCount: 'operator.siteStats.metricLikes',
  favoriteCount: 'operator.siteStats.metricFavorites',
  commentCount: 'operator.siteStats.metricComments',
  spendPoints: 'operator.siteStats.metricSpend',
  spendKkMinor: 'operator.siteStats.metricSpendKk',
  aiTokens: 'operator.siteStats.metricAiTokens',
};

const OPERATOR_PRESET_LABEL_KEYS: Record<OperatorStatsPreset, string> = {
  today: 'operator.siteStats.presetToday',
  yesterday: 'operator.siteStats.presetYesterday',
  last7: 'operator.siteStats.presetLast7',
  last30: 'operator.siteStats.presetLast30',
  thisWeek: 'operator.siteStats.presetThisWeek',
  thisMonth: 'operator.siteStats.presetThisMonth',
  lastMonth: 'operator.siteStats.presetLastMonth',
  all: 'operator.siteStats.presetAll',
  custom: 'operator.siteStats.presetCustom',
};

export function operatorMetricLabelKey(metric: OperatorKpiKey): string {
  return OPERATOR_METRIC_LABEL_KEYS[metric];
}

export function formatOperatorTokenCount(value: number): string {
  const safe = Math.max(0, Number(value) || 0);
  const compact = (amount: number) => amount.toFixed(2).replace(/\.?0+$/, '');
  if (safe >= 1_000_000) return `${compact(safe / 1_000_000)}M`;
  if (safe >= 1_000) return `${compact(safe / 1_000)}K`;
  return Math.floor(safe).toLocaleString();
}

export function formatOperatorKkAmount(minorUnits: number): string {
  const amount = Number(minorUnits || 0) / 100;
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function operatorPresetLabelKey(preset: OperatorStatsPreset): string {
  return OPERATOR_PRESET_LABEL_KEYS[preset];
}

export interface OperatorDateRange {
  startDate?: string;
  endDate?: string;
}

export function operatorCustomRangeDraft(
  preset: OperatorStatsPreset,
  range: OperatorDateRange,
): OperatorDateRange {
  return preset === 'custom' ? range : resolveOperatorStatsRange(preset === 'all' ? 'last7' : preset);
}

export function operatorCustomRangeError(startDate: string, endDate: string): 'required' | 'invalid' | null {
  if (!startDate || !endDate) return 'required';
  const isRealDate = (value: string) => {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!isRealDate(startDate) || !isRealDate(endDate) || startDate > endDate) return 'invalid';
  return null;
}

/** 功能注释：取上海日历下 iso 日的星期（0=周日） */
function shanghaiWeekday(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00+08:00`).getUTCDay();
}

/** 功能注释：本周一（周一为一周起始） */
function shanghaiWeekMonday(isoDate: string): string {
  const weekday = shanghaiWeekday(isoDate);
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return shiftIsoDate(isoDate, offset);
}

export function resolveOperatorStatsRange(
  preset: OperatorStatsPreset,
  custom?: OperatorDateRange,
): OperatorDateRange {
  const today = shanghaiTodayIso();
  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const yesterday = shiftIsoDate(today, -1);
      return { startDate: yesterday, endDate: yesterday };
    }
    case 'last7':
      return { startDate: shiftIsoDate(today, -6), endDate: today };
    case 'last30':
      return { startDate: shiftIsoDate(today, -29), endDate: today };
    case 'thisWeek':
      return { startDate: shanghaiWeekMonday(today), endDate: today };
    case 'thisMonth': {
      const [year, month] = today.split('-');
      return { startDate: `${year}-${month}-01`, endDate: today };
    }
    case 'lastMonth': {
      const [year, month] = today.split('-').map(Number);
      const firstThisMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastPrev = shiftIsoDate(firstThisMonth, -1);
      const [py, pm] = lastPrev.split('-');
      return { startDate: `${py}-${pm}-01`, endDate: lastPrev };
    }
    case 'all':
      return {};
    case 'custom':
      return {
        startDate: custom?.startDate || undefined,
        endDate: custom?.endDate || undefined,
      };
    default:
      return { startDate: shiftIsoDate(today, -6), endDate: today };
  }
}

/** 功能注释：KPI 旁「较上期」细分文案 key（数值仍用后端 deltaRatio） */
export function operatorDeltaLabelKey(preset: OperatorStatsPreset): string {
  switch (preset) {
    case 'today':
      return 'operator.siteStats.deltaVsYesterday';
    case 'yesterday':
      return 'operator.siteStats.deltaVsDayBefore';
    case 'thisWeek':
      return 'operator.siteStats.deltaVsLastWeek';
    case 'thisMonth':
      return 'operator.siteStats.deltaVsLastMonth';
    case 'lastMonth':
      return 'operator.siteStats.deltaVsPrevious';
    default:
      return 'operator.siteStats.deltaVsPrevious';
  }
}

/** 功能注释：运营时长展示 — ≥1h 整小时，不足 1h 为 Xm */
export function formatOperatorPlayDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safe < 3600) return `${Math.floor(safe / 60)}m`;
  return `${Math.floor(safe / 3600)}h`;
}

export function formatOperatorDeltaRatio(ratio: number | null | undefined): {
  text: string;
  direction: 'up' | 'down' | 'flat';
} {
  if (ratio == null || Number.isNaN(Number(ratio))) {
    return { text: '—', direction: 'flat' };
  }
  const value = Number(ratio);
  const pct = `${(Math.abs(value) * 100).toFixed(1)}%`;
  if (value > 0) return { text: `+${pct}`, direction: 'up' };
  if (value < 0) return { text: `-${pct}`, direction: 'down' };
  return { text: pct, direction: 'flat' };
}

export function formatOperatorPublishedAt(
  value: string | null | undefined,
  options?: { withTime?: boolean },
): string {
  if (!value) return '—';
  if (!options?.withTime && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  try {
    const formatted = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(options?.withTime
        ? { hour: '2-digit' as const, minute: '2-digit' as const, hour12: false }
        : {}),
    }).format(new Date(value));
    return formatted.replace(/\//g, '-');
  } catch {
    return options?.withTime ? value : value.slice(0, 10);
  }
}

/** 功能注释：运营统计封面 — 与首页一致走 display-cover + ASSET_HOST */
export function resolveOperatorCoverSrc(coverUrl: string | null | undefined): string {
  const display = toDisplayCoverUrl(coverUrl);
  return getImageUrl(display || coverUrl);
}

/** 功能注释：display-cover 失败时回退原图绝对地址 */
export function resolveOperatorCoverFallbackSrc(
  failedDisplayPathOrUrl: string | null | undefined,
  coverUrl: string | null | undefined,
): string {
  const failed = String(failedDisplayPathOrUrl || '');
  const pathOnly = failed.replace(/^https?:\/\/[^/]+/i, '') || failed;
  const displayPath = toDisplayCoverUrl(coverUrl) || '';
  const fallbackPath = coverUrlAfterDisplayCoverError(displayPath || pathOnly, coverUrl);
  return fallbackPath ? getImageUrl(fallbackPath) : '';
}

export function isOperatorSortBy(value: string | null | undefined): value is OperatorSortBy {
  return Boolean(value && OPERATOR_METRIC_KEYS.includes(value as OperatorSortBy));
}

/** 功能注释：运营全站统计搜索类型（与后端 searchType 对齐） */
export type OperatorStatsSearchType = 'title' | 'fileId' | 'nickname' | 'userCode' | 'phone';

export const OPERATOR_SEARCH_TYPES: OperatorStatsSearchType[] = [
  'title',
  'fileId',
  'nickname',
  'userCode',
  'phone',
];

export function isOperatorStatsSearchType(
  value: string | null | undefined,
): value is OperatorStatsSearchType {
  return Boolean(value && OPERATOR_SEARCH_TYPES.includes(value as OperatorStatsSearchType));
}

export function operatorSearchTypeLabelKey(type: OperatorStatsSearchType): string {
  switch (type) {
    case 'title':
      return 'operator.siteStats.searchTypeTitle';
    case 'fileId':
      return 'operator.siteStats.searchTypeFileId';
    case 'nickname':
      return 'operator.siteStats.searchTypeNickname';
    case 'userCode':
      return 'operator.siteStats.searchTypeUserCode';
    case 'phone':
      return 'operator.siteStats.searchTypePhone';
    default:
      return 'operator.siteStats.searchTypeTitle';
  }
}

export function operatorSearchPlaceholderKey(type: OperatorStatsSearchType): string {
  switch (type) {
    case 'title':
      return 'operator.siteStats.searchPlaceholderTitle';
    case 'fileId':
      return 'operator.siteStats.searchPlaceholderFileId';
    case 'nickname':
      return 'operator.siteStats.searchPlaceholderNickname';
    case 'userCode':
      return 'operator.siteStats.searchPlaceholderUserCode';
    case 'phone':
      return 'operator.siteStats.searchPlaceholderPhone';
    default:
      return 'operator.siteStats.searchPlaceholderTitle';
  }
}

/**
 * 功能注释：运营搜索前端校验（空串由调用方单独提示）。
 * phone 类型：位数不对 → invalid；其余类型仅拦控制字符。
 */
export function validateOperatorStatsSearchQuery(
  q: string,
  searchType: OperatorStatsSearchType = 'title',
): 'ok' | 'invalid' {
  const s = q.trim();
  if (!s) return 'invalid';
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) {
      return 'invalid';
    }
  }

  if (searchType === 'phone') {
    const compact = s.replace(/[\s-]/g, '');
    const afterCn = compact.replace(/^\+?86/, '');
    if (!/^1\d{10}$/.test(afterCn)) return 'invalid';
  }

  return 'ok';
}

/** 功能注释：排序指标为 0 或 rank 缺失时展示「—」（计划书异常：作品数据为空） */
export function formatOperatorWorkRank(
  rank: number | null | undefined,
  sortMetricValue: number | null | undefined,
): string {
  if (rank == null || rank <= 0) return '—';
  if ((sortMetricValue ?? 0) === 0) return '—';
  return String(rank);
}

/** 功能注释：列表↔详情互带查询串 */
export function buildOperatorStatsQuery(params: {
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  order?: string;
  q?: string;
  searchType?: string;
  creatorUserId?: string;
  preset?: string;
}): string {
  const search = new URLSearchParams();
  if (params.preset) search.set('preset', params.preset);
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.order) search.set('order', params.order);
  if (params.q) {
    search.set('q', params.q);
    if (params.searchType) search.set('searchType', params.searchType);
  }
  if (params.creatorUserId) search.set('creatorUserId', params.creatorUserId);
  return search.toString();
}

export function parseOperatorStatsQuery(search: string): {
  preset: OperatorStatsPreset;
  startDate?: string;
  endDate?: string;
  sortBy: OperatorSortBy;
  order: 'asc' | 'desc';
  q: string;
  searchType: OperatorStatsSearchType;
  creatorUserId: string;
} {
  const params = new URLSearchParams(search);
  const rawPreset = params.get('preset') || '';
  const startDate = params.get('startDate') || undefined;
  const endDate = params.get('endDate') || undefined;
  // 功能注释：运营全站统计无 query 时默认「全部」（非近 7 日）
  let preset: OperatorStatsPreset = 'all';
  if (
    rawPreset === 'today'
    || rawPreset === 'yesterday'
    || rawPreset === 'last7'
    || rawPreset === 'last30'
    || rawPreset === 'thisWeek'
    || rawPreset === 'thisMonth'
    || rawPreset === 'lastMonth'
    || rawPreset === 'all'
    || rawPreset === 'custom'
  ) {
    preset = rawPreset;
  } else if (startDate || endDate) {
    preset = 'custom';
  }

  const sortRaw = params.get('sortBy');
  const sortBy = isOperatorSortBy(sortRaw) ? sortRaw : 'pv';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';
  const searchTypeRaw = params.get('searchType');
  const searchType = isOperatorStatsSearchType(searchTypeRaw) ? searchTypeRaw : 'title';
  return {
    preset,
    startDate,
    endDate,
    sortBy,
    order,
    q: params.get('q') || '',
    searchType,
    creatorUserId: params.get('creatorUserId') || '',
  };
}
