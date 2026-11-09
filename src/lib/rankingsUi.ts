/**
 * 功能注释：排行榜页 UI 纯逻辑——可见 Tab、热度/收藏取值，便于单测且不删飙升/互动接口映射。
 */

/**
 * 功能注释：榜单简介只展示纯文本。发布侧常存 `<p>…</p>` 富文本，直接渲染会露出标签。
 * 这里做轻量剥标签（不依赖 DOM），把块级换行压成空格后单行展示。
 */
export function resolveRankingsPlainDescription(raw: unknown): string {
  const value = String(raw ?? '');
  if (!value.trim()) return '';
  const withoutTags = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
  return withoutTags.replace(/\s+/g, ' ').trim();
}

/** 用户侧可见的顶栏 Tab（飙升/互动/高分先隐藏，接口与内部 key 仍保留） */
export const RANKINGS_VISIBLE_TAB_KEYS = ['all', 'hot', 'new', 'authors'] as const;

export type RankingsVisibleTabKey = (typeof RANKINGS_VISIBLE_TAB_KEYS)[number];

/** 「全部」页分区：只露出人气/新作/作者，飙升与互动分区一并隐藏 */
export const RANKINGS_VISIBLE_ALL_SECTION_KEYS = ['overall', 'new', 'authors'] as const;

export type RankingsHeatFavoriteSource = {
  total_uv_count?: unknown;
  total_pv_count?: unknown;
  like_count?: unknown;
  favorite_count?: unknown;
  playCount?: unknown;
  likeCount?: unknown;
  favoriteCount?: unknown;
};

/**
 * 功能注释：热度优先 UV，其次 PV；收藏优先 favorite_count，否则回落 like_count（与首页收藏徽标同口径）。
 */
export function resolveRankingsHeatAndFavorite(source: RankingsHeatFavoriteSource): {
  heat: number;
  favorite: number;
} {
  const uv = Number(source.total_uv_count);
  const pv = Number(source.total_pv_count);
  const play = Number(source.playCount);
  const heatCandidate = Number.isFinite(uv) && uv > 0
    ? uv
    : (Number.isFinite(pv) && pv > 0
      ? pv
      : (Number.isFinite(play) && play > 0 ? play : 0));

  const favoriteRaw = Number(source.favorite_count ?? source.favoriteCount);
  const likeRaw = Number(source.like_count ?? source.likeCount);
  const favorite = Number.isFinite(favoriteRaw) && favoriteRaw > 0
    ? Math.floor(favoriteRaw)
    : (Number.isFinite(likeRaw) && likeRaw > 0 ? Math.floor(likeRaw) : 0);

  return {
    heat: Number.isFinite(heatCandidate) ? Math.floor(heatCandidate) : 0,
    favorite,
  };
}

export function isRankingsVisibleTabKey(key: string): key is RankingsVisibleTabKey {
  return (RANKINGS_VISIBLE_TAB_KEYS as readonly string[]).includes(key);
}

export function isRankingsVisibleAllSectionKey(key: string): boolean {
  return (RANKINGS_VISIBLE_ALL_SECTION_KEYS as readonly string[]).includes(key);
}

/** 功能注释：各顶栏 Tab 对应的内容面板类型，切换时不得串用「全部」三列网格与单榜列表样式。 */
export type RankingsPanelKind = 'all-grid' | 'game-list' | 'author-list';

export function resolveRankingsPanelKind(tab: string): RankingsPanelKind {
  if (tab === 'all') return 'all-grid';
  if (tab === 'authors') return 'author-list';
  return 'game-list';
}

type RankingsLoadFlags = {
  loaded: boolean;
  loading: boolean;
};

/**
 * 功能注释：是否应发起榜单拉取。只看 loaded——loading 可能因切 Tab 中止残留，
 * 若写成 !loaded && !loading 会永久卡死，来回点两次 Tab 就再也拉不起来。
 */
export function shouldFetchRankingsTab(state: RankingsLoadFlags): boolean {
  return !state.loaded;
}

/**
 * 功能注释：请求被切 Tab 中止后复位 loading 门闩，保留已有 data/loaded。
 */
export function clearRankingsLoadingFlags<T extends { loading: boolean; loadingMore?: boolean }>(
  state: T,
): T {
  if ('loadingMore' in state) {
    return { ...state, loading: false, loadingMore: false };
  }
  return { ...state, loading: false };
}

/**
 * 功能注释：分页追加后是否还有下一页。空页或本页 ID 全是重复（offset 失效）时必须停，
 * 否则 IntersectionObserver 会一直拉，堆出成百上千张卡，切 Tab 时 React 复用 DOM 就乱版。
 */
export function resolveRankingsHasMore(options: {
  pageSize: number;
  fetchedCount: number;
  newUniqueCount: number;
}): boolean {
  const pageSize = Math.max(1, Math.floor(options.pageSize) || 1);
  const fetched = Math.max(0, Math.floor(options.fetchedCount) || 0);
  const uniqueNew = Math.max(0, Math.floor(options.newUniqueCount) || 0);
  if (fetched <= 0) return false;
  if (uniqueNew <= 0) return false;
  return fetched >= pageSize;
}

/** 功能注释：按稳定 id 去重合并，避免无限滚动把同一批条目反复 append */
export function mergeRankingsUniqueById<T>(
  prev: readonly T[],
  next: readonly T[],
  getId: (item: T) => string,
): { merged: T[]; newUniqueCount: number } {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of prev) {
    const id = getId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }
  let newUniqueCount = 0;
  for (const item of next) {
    const id = getId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
    newUniqueCount += 1;
  }
  return { merged, newUniqueCount };
}
