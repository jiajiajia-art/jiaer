/**
 * 刚刚中奖列表：自动轮播时长策略（供组件与单测共用）。
 */

/**
 * 功能注释：≥2 条时开启自动轮播；时长随条数变长，保证可读。
 * @returns 动画秒数；不足以轮播时返回 null
 */
export function resolveRecentWinnersMarqueeSeconds(itemCount: number): number | null {
  const n = Math.floor(Number(itemCount) || 0);
  if (n < 2) return null;
  return Math.max(10, Math.round(n * 2.2));
}
