/**
 * 功能注释：排行榜页 UI 纯逻辑——可见 Tab、热度/收藏取值，便于单测且不删飙升/互动接口映射。
 */

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
