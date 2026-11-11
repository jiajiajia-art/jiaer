/**
 * 对话/立绘展示 URL。
 * 【硬性】禁止把历史 base_*.png 改写成同名 .webp：R2 常无 webp，前端臆造会制造 Network 红字/失败，
 * 再靠 png/_150 兜底——用户不可接受。文档路径原样；已是 webp（含 *_150.webp）保持。
 * 压缩 webp 由后端生图/懒转写入后再出现在文档里。
 */
export function preferCharacterPortraitWebp(
  imagePath: string | null | undefined,
): string {
  const raw = typeof imagePath === 'string' ? imagePath : String(imagePath || '');
  return raw;
}

/**
 * 功能注释：若 URL 已是角色 webp 且拉取失败，回退同名 png（兜底，正常路径不应触发）。
 */
export function fallbackCharacterPortraitPng(
  imagePath: string | null | undefined,
): string {
  const raw = typeof imagePath === 'string' ? imagePath : String(imagePath || '');
  if (!raw) return '';
  const qIndex = raw.search(/[?#]/);
  const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const suffix = qIndex >= 0 ? raw.slice(qIndex) : '';
  if (!/\/(?:npcs|players)\//i.test(pathOnly)) return '';
  if (!/\.webp$/i.test(pathOnly)) return '';
  // 150 小图失败不回退成去掉 _150 的「假原图 webp」
  if (/_150\.webp$/i.test(pathOnly) || /\.150\.webp$/i.test(pathOnly)) return '';
  return `${pathOnly.replace(/\.webp$/i, '.png')}${suffix}`;
}
