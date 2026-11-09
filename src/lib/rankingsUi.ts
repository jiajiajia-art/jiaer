/**
 * 功能注释：排行榜页 UI 纯逻辑——榜单简介剥 HTML，避免子榜卡片直接露出 `<p>` 等标签。
 */

/**
 * 功能注释：榜单简介只展示纯文本。发布侧常存 `<p>…</p>` 富文本，React 文本节点会原样显示标签。
 * 这里做轻量剥标签（不依赖 DOM），把块级换行压成空格后供单行/多行摘要展示。
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
