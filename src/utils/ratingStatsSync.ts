/**
 * 功能注释：详情页评分汇总是否与上次相同。
 * 相同则跳过 setState，避免内联 onRatingChange + GameRating 拉列表形成请求死循环。
 */
export type RatingStatsSnapshot = {
  average: number | null | undefined;
  count: number;
};

export function ratingStatsEqual(
  prev: RatingStatsSnapshot | null | undefined,
  next: RatingStatsSnapshot | null | undefined,
): boolean {
  if (prev == null && next == null) return true;
  if (prev == null || next == null) return false;
  const prevAvg = prev.average == null ? null : Number(prev.average);
  const nextAvg = next.average == null ? null : Number(next.average);
  const avgSame =
    (prevAvg == null && nextAvg == null) ||
    (prevAvg != null && nextAvg != null && prevAvg === nextAvg);
  return avgSame && Number(prev.count) === Number(next.count);
}
