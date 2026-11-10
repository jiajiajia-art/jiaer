import { shiftIsoDate, shanghaiTodayIso } from './operatorReportChart.ts';

/** 功能注释：运营全站统计时间快捷（Asia/Shanghai）；lastMonth 仅供自定义弹层快捷，不入 URL preset */
export type OperatorStatsPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'lastMonth'
  | 'all'
  | 'custom';

/** 功能注释：URL 可解析的 preset；不含 lastMonth / 已下线的 thisWeek|thisMonth */
export const OPERATOR_STATS_URL_PRESETS: ReadonlyArray<Exclude<OperatorStatsPreset, 'lastMonth'>> = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'all',
  'custom',
];

export type OperatorSortBy =
  | 'pv'
  | 'uv'
  | 'playCount'
  | 'playDurationSeconds'
  | 'likeCount'
  | 'favoriteCount'
  | 'commentCount'
  | 'spendPoints';

export const OPERATOR_METRIC_KEYS: OperatorSortBy[] = [
  'pv',
  'uv',
  'playCount',
  'playDurationSeconds',
  'likeCount',
  'favoriteCount',
  'commentCount',
  'spendPoints',
];

const OPERATOR_METRIC_LABEL_KEYS: Record<OperatorSortBy, string> = {
  pv: 'operator.siteStats.metricPv',
  uv: 'operator.siteStats.metricUv',
  playCount: 'operator.siteStats.metricPlayCount',
  playDurationSeconds: 'operator.siteStats.metricPlayDuration',
  likeCount: 'operator.siteStats.metricLikes',
  favoriteCount: 'operator.siteStats.metricFavorites',
  commentCount: 'operator.siteStats.metricComments',
  spendPoints: 'operator.siteStats.metricSpend',
};

const OPERATOR_PRESET_LABEL_KEYS: Record<OperatorStatsPreset, string> = {
  today: 'operator.siteStats.presetToday',
  yesterday: 'operator.siteStats.presetYesterday',
  last7: 'operator.siteStats.presetLast7',
  last30: 'operator.siteStats.presetLast30',
  lastMonth: 'operator.siteStats.presetLastMonth',
  all: 'operator.siteStats.presetAll',
  custom: 'operator.siteStats.presetCustom',
};

export function operatorMetricLabelKey(metric: OperatorSortBy): string {
  return OPERATOR_METRIC_LABEL_KEYS[metric];
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
  if (startDate > endDate) return 'invalid';
  return null;
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

export function isOperatorSortBy(value: string | null | undefined): value is OperatorSortBy {
  return Boolean(value && OPERATOR_METRIC_KEYS.includes(value as OperatorSortBy));
}

function isOperatorStatsUrlPreset(
  value: string,
): value is Exclude<OperatorStatsPreset, 'lastMonth'> {
  return (OPERATOR_STATS_URL_PRESETS as ReadonlyArray<string>).includes(value);
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
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) return 'invalid';

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

  // 功能注释：无合法 URL preset 时，有日期 → custom，否则 → all（含 lastMonth/thisWeek 等下线值）
  let preset: OperatorStatsPreset = 'all';
  if (isOperatorStatsUrlPreset(rawPreset)) {
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
