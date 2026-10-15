import { portraitCoverUrl } from './gameCovers.ts';

/**
 * 游戏封面展示路径：原图 cover → display-cover webp（与后端列表推导规则一致）
 */

/** 去掉 query/hash，避免路径匹配失败 */
const pathOnly = (url: string): string => url.split(/[?#]/, 1)[0] || '';

/** 原图 …/cover/xxx → 展示图 …/display-cover/cover.webp */
export const toDisplayCoverUrl = (coverUrl: string | null | undefined): string => {
  const raw = typeof coverUrl === 'string' ? coverUrl.trim() : '';
  if (!raw) return '';
  // 去掉 query/hash，避免 …/cover/cover.png?t=1 匹配失败
  const only = pathOnly(raw);
  if (!only) return '';
  return only.replace(/\/cover\/[^/]+$/i, '/display-cover/cover.webp');
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

/**
 * 功能注释：原图 cover 路径（不做 display-cover 改写），供 display-cover 404 时回退。
 */
export const resolveOriginalCoverUrl = (
  game: { cover_url?: string | null } | null | undefined,
): string => {
  const cover = typeof game?.cover_url === 'string' ? game.cover_url.trim() : '';
  return cover ? pathOnly(cover) : '';
};

/**
 * 功能注释：display-cover 加载失败时回退到 cover_url；已是原图或无原图则返回空。
 */
export const coverUrlAfterDisplayCoverError = (
  failedUrl: string | null | undefined,
  coverUrl: string | null | undefined,
): string => {
  const failed = typeof failedUrl === 'string' ? pathOnly(failedUrl.trim()) : '';
  const original = typeof coverUrl === 'string' ? pathOnly(coverUrl.trim()) : '';
  if (!original) return '';
  if (!failed || !/\/display-cover\//i.test(failed)) return '';
  if (original === failed) return '';
  return original;
};

/**
 * 功能注释：首页/列表 3:4 卡片优先竖版封面；不得把 portrait-cover 再改写成 display-cover。
 */
export const resolveGameListCoverUrl = (
  game: {
    portrait_cover_url?: string | null;
    portraitCoverUrl?: string | null;
    display_cover_url?: string | null;
    cover_url?: string | null;
  } | null | undefined,
): string => {
  const portrait = portraitCoverUrl(game);
  if (portrait) return portrait;
  return resolveGameCoverUrl(game);
};
