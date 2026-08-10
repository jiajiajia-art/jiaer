/**
 * 玩家展示名：排除「玩家」等占位，优先局内档案 → 开局包 → 文档主角。
 */

export const PLAYER_DISPLAY_NAME_FALLBACK = '旅人';

const PLACEHOLDER_NAMES = new Set([
  '玩家',
  '用户',
  '主角',
  '旅人', // 系统兜底名，有文档主角时应被覆盖
  'player',
  'user',
  'you',
  'traveler',
  'wanderer',
]);

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

/** 功能注释：空串与「玩家」等占位视为无效展示名。 */
export function isPlaceholderPlayerName(name: unknown): boolean {
  const n = trimStr(name);
  if (!n) return true;
  return PLACEHOLDER_NAMES.has(n) || PLACEHOLDER_NAMES.has(n.toLowerCase());
}

/**
 * 功能注释：按候选顺序取第一个有效名。
 * 注意：全部无效时返回空串，由调用方决定是否再用「旅人」兜底；
 * 避免把兜底名写进 session 后无法再被文档主角覆盖。
 */
export function resolvePlayerDisplayName(
  candidates: unknown[],
  fallback: string = '',
): string {
  for (const raw of candidates) {
    const n = trimStr(raw);
    if (n && !isPlaceholderPlayerName(n)) return n;
  }
  const fb = trimStr(fallback);
  if (fb && !isPlaceholderPlayerName(fb)) return fb;
  return '';
}

/** 功能注释：展示/表单用；无有效名时才显示「旅人」。 */
export function resolvePlayerDisplayNameOrFallback(
  candidates: unknown[],
  fallback: string = PLAYER_DISPLAY_NAME_FALLBACK,
): string {
  return resolvePlayerDisplayName(candidates, fallback) || PLAYER_DISPLAY_NAME_FALLBACK;
}
