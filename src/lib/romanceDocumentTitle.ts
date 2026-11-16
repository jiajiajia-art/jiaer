/**
 * 功能注释：嵌入主站 /romance/ 时的浏览器标签标题。
 * 须覆盖 Figma 独立壳残留的演示作名（如「今夜她是主角」），统一 Funloom 品牌。
 */
export function resolveRomanceDocumentTitle(search: string): string {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const flag = (k: string) => {
    const v = q.get(k);
    return v === '1' || v === 'true';
  };
  if (flag('createWorld') || flag('worldGen')) return '生成世界 · Funloom';
  if (flag('createPlayMod')) return '创作玩法 · Funloom';
  if (flag('reviewPreview')) return '审核预览 · Funloom';
  if (flag('play') && String(q.get('fileId') || '').trim()) return '游玩 · Funloom';
  if (flag('kkappPreview')) return '玩法预览 · Funloom';
  return 'Romance · Funloom';
}
