/**
 * 功能注释：用户头像展示优先走后端 ?format=webp（懒转/已有 *_150.webp 旁路）。
 * 不臆造把 .png 改写成 _150.webp 路径——对象可能尚不存在，会制造 Network 红字。
 * 原图 key 仍保留在 DB / OSS；页面只改引用查询参数。
 */
export function preferUserAvatarWebp(
  imagePath: string | null | undefined,
): string {
  const raw = typeof imagePath === 'string' ? imagePath : String(imagePath || '');
  if (!raw) return '';
  if (!/interactive-fiction-game-avatar\//i.test(raw)) return raw;
  if (/\.webp(?:[?#]|$)/i.test(raw)) return raw;
  if (/[?&]format=webp\b/i.test(raw)) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}format=webp`;
}
