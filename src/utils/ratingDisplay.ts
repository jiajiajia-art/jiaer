/**
 * 功能注释：玩家侧评分展示规则（对齐 TapTap / 豆瓣式做法）
 * - 用户打分为 1–5 星，后端 rating_avg 为五星制平均分；
 * - 对外展示换算为十分制：平均星数 × 2，保留 1 位小数；
 * - 评分人数不足 RATING_MIN_COUNT 时不展示分数，显示「暂无评分」，禁止写死默认分。
 */
export const RATING_MIN_COUNT = 1;

export type RatingDisplay =
  | { hasScore: true; score: string; count: number }
  | { hasScore: false; count: number };

export function toTenPointScore(avgFiveStar: number): number {
  const clamped = Math.min(5, Math.max(0, avgFiveStar));
  return Math.round(clamped * 2 * 10) / 10;
}

export function resolveRatingDisplay(
  avgFiveStar: number | string | null | undefined,
  count: number | string | null | undefined,
): RatingDisplay {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const avg = Number(avgFiveStar);
  if (n < RATING_MIN_COUNT || !Number.isFinite(avg) || avg <= 0) {
    return { hasScore: false, count: n };
  }
  return { hasScore: true, score: toTenPointScore(avg).toFixed(1), count: n };
}
