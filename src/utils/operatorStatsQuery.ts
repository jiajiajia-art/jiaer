/**
 * 功能注释：运营统计 URL query 解析（无 UI/资源依赖，供 Node check 与页面共用）。
 */

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

export type OperatorStatsSearchType = 'title' | 'fileId' | 'nickname' | 'userCode' | 'phone';

export const OPERATOR_SEARCH_TYPES: OperatorStatsSearchType[] = [
  'title',
  'fileId',
  'nickname',
  'userCode',
  'phone',
];

export function isOperatorSortBy(value: string | null | undefined): value is OperatorSortBy {
  return Boolean(value && OPERATOR_METRIC_KEYS.includes(value as OperatorSortBy));
}

export function isOperatorStatsSearchType(
  value: string | null | undefined,
): value is OperatorStatsSearchType {
  return Boolean(value && OPERATOR_SEARCH_TYPES.includes(value as OperatorStatsSearchType));
}

/** 功能注释：运营全站统计 URL preset；还原周/月快捷后须原样保留，未知值才回落 */
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
