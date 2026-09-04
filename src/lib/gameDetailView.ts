/**
 * 功能注释：作品详情页展示辅助（紧凑计数、制作信息行、简介是否需展开），对齐效果图文案结构。
 */

export type GameDetailTagSource = {
  theme_tag_names?: unknown;
  game_tags?: unknown;
};

export type GameDetailMetaSource = GameDetailTagSource & {
  author_name?: unknown;
  subtitle?: unknown;
  chapter_count?: unknown;
  duration_minutes?: unknown;
};

const DESCRIPTION_COLLAPSE_LEN = 140;
const MAX_TAGS = 3;

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 功能注释：把点赞/收藏等整数格式化为 892 / 8.5k，避免效果图量级在窄屏溢出。 */
export function formatDetailStatCount(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '0';
  const floored = Math.floor(n);
  if (floored < 1000) return String(floored);
  if (floored < 10_000) {
    const k = floored / 1000;
    const text = k >= 10 ? String(Math.floor(k)) : k.toFixed(1).replace(/\.0$/, '');
    return `${text}k`;
  }
  if (floored < 1_000_000) {
    return `${Math.floor(floored / 1000)}k`;
  }
  return `${(floored / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
}

/** 功能注释：英雄区副文案「由 X 制作 · …」，章节/时长有数据才拼，避免空占位。 */
export function buildGameDetailMetaLine(
  game: GameDetailMetaSource,
  labels: { producedBy: (author: string) => string; chapterUnit: string; minuteUnit: string },
): string {
  const author = String(game.author_name ?? '').trim() || '';
  const parts: string[] = [];
  if (author) {
    parts.push(labels.producedBy(author));
  }

  const chapters = Number(game.chapter_count);
  if (Number.isFinite(chapters) && chapters > 0) {
    parts.push(`${Math.floor(chapters)}${labels.chapterUnit}`);
  }

  const minutes = Number(game.duration_minutes);
  if (Number.isFinite(minutes) && minutes > 0) {
    parts.push(`${Math.floor(minutes)}${labels.minuteUnit}`);
  }

  const subtitle = String(game.subtitle ?? '').trim();
  if (parts.length <= 1 && subtitle) {
    parts.push(subtitle);
  }

  return parts.join(' · ');
}

/** 功能注释：题材标签来自 theme_tag_names（过滤「全部」），最多 3 个；与列表卡片规则一致。 */
export function resolveGameDetailTags(game: GameDetailTagSource): string[] {
  const names = Array.isArray(game.theme_tag_names) ? game.theme_tag_names : [];
  const tags = names
    .map((name) => cleanText(name))
    .filter((name) => name && name !== '全部');
  if (tags.length > 0) return tags.slice(0, MAX_TAGS);

  const raw = cleanText(game.game_tags)
    .replace(/^\[|\]$/g, '')
    .replace(/^["']|["']$/g, '');
  if (!raw) return [];
  return raw
    .split(/[,，/|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

/** 功能注释：纯文本简介超过阈值时展示「阅读更多」。 */
export function descriptionNeedsExpand(plainText: string, maxLen = DESCRIPTION_COLLAPSE_LEN): boolean {
  return String(plainText || '').trim().length > maxLen;
}
