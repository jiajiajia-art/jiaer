/**
 * 游戏封面展示路径：原图 cover → display-cover webp（与后端列表推导规则一致）
 */

/** 原图 …/cover/xxx → 展示图 …/display-cover/cover.webp */
export const toDisplayCoverUrl = (coverUrl: string | null | undefined): string => {
  const raw = typeof coverUrl === 'string' ? coverUrl.trim() : '';
  if (!raw) return '';
  // 去掉 query/hash，避免 …/cover/cover.png?t=1 匹配失败
  const pathOnly = raw.split(/[?#]/, 1)[0] || '';
  if (!pathOnly) return '';
  return pathOnly.replace(/\/cover\/[^/]+$/i, '/display-cover/cover.webp');
};

/**
 * 详情/列表展示封面：优先 display_cover_url，否则用 cover_url。
 * 无论来源，一律再跑 toDisplayCoverUrl，避免预览态误把原图路径塞进 display_cover_url 后仍请求 cover.png。
 */
export const resolveGameCoverUrl = (
  game: { display_cover_url?: string | null; cover_url?: string | null } | null | undefined,
): string => {
  const display = typeof game?.display_cover_url === 'string' ? game.display_cover_url.trim() : '';
  const cover = typeof game?.cover_url === 'string' ? game.cover_url.trim() : '';
  const preferred = display || cover;
  if (!preferred) return '';
  return toDisplayCoverUrl(preferred);
};
