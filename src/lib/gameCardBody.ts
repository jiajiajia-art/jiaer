/**
 * 功能注释：列表卡片正文区（简介 + 题材标签 + 收藏徽标）解析，对齐首页效果图。
 */

import { isGameEngineStorageTag } from '../utils/gameTypeLabel.ts';

export type GameCardBodySource = {
  subtitle?: unknown;
  description?: unknown;
  theme_tag_names?: unknown;
  game_tags?: unknown;
  like_count?: unknown;
  favorite_count?: unknown;
};

export type GameCardBodyView = {
  subtitle: string;
  tags: string[];
  collectBadge: string | null;
};

const MAX_TAGS = 3;
const MAX_SUBTITLE = 28;

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

/** 功能注释：收藏徽标优先 favorite_count，否则回落 like_count，无数据不展示。 */
export function resolveGameCardCollectBadge(game: GameCardBodySource): string | null {
  const favorite = Number(game.favorite_count);
  const like = Number(game.like_count);
  const count = Number.isFinite(favorite) && favorite > 0
    ? Math.floor(favorite)
    : (Number.isFinite(like) && like > 0 ? Math.floor(like) : 0);
  if (count <= 0) return null;
  return `${count}人收藏`;
}

/** 功能注释：简介优先 subtitle，否则截取 description 纯文本。 */
export function resolveGameCardSubtitle(game: GameCardBodySource): string {
  const subtitle = cleanText(game.subtitle);
  if (subtitle) return truncate(subtitle, MAX_SUBTITLE);
  const description = cleanText(game.description);
  if (!description) return '';
  return truncate(description, MAX_SUBTITLE);
}

export type SearchResultSecondarySource = GameCardBodySource & {
  title?: unknown;
  author_name?: unknown;
};

/**
 * 功能注释：搜索下拉第二行；与标题重复时跳过，避免「两行同一句」。
 * 优先不同的 subtitle → description → 作者 → 题材标签。
 */
export function resolveSearchResultSecondaryLine(game: SearchResultSecondarySource): string {
  const title = cleanText(game.title);
  const subtitle = cleanText(game.subtitle);
  if (subtitle && subtitle !== title) {
    return truncate(subtitle, MAX_SUBTITLE);
  }

  const description = cleanText(game.description);
  if (description && description !== title) {
    return truncate(description, MAX_SUBTITLE);
  }

  const author = cleanText(game.author_name);
  if (author) return author;

  const tags = resolveGameCardTags(game);
  if (tags.length > 0) return tags.join(' · ');

  return '';
}

/**
 * 功能注释：题材标签只取 theme_tag_names，过滤「全部」与入库引擎码（封面角标已展示），最多 3 个；
 * 不回落 game_tags（与封面玩法类型重复）。
 */
export function resolveGameCardTags(game: GameCardBodySource): string[] {
  const names = Array.isArray(game.theme_tag_names) ? game.theme_tag_names : [];
  return names
    .map((name) => cleanText(name))
    .filter((name) => name && name !== '全部' && !isGameEngineStorageTag(name))
    .slice(0, MAX_TAGS);
}

export function resolveGameCardBody(game: GameCardBodySource): GameCardBodyView {
  return {
    subtitle: resolveGameCardSubtitle(game),
    tags: resolveGameCardTags(game),
    collectBadge: resolveGameCardCollectBadge(game),
  };
}
