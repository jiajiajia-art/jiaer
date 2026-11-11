/**
 * 功能注释：应用商店「今天」Tab 推送（C3）。
 * 从「未装且非 widget」池里按 careerDay 确定性抽最多 3 个，禁止整表当精选。
 */

export type TodayCatalogItem = {
  id: string;
  kind?: string | null;
};

/** 功能注释：确定性字符串哈希，同一天同一 pool 顺序 → 同一结果 */
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 功能注释：按生涯日种子从候选池无放回抽最多 maxCount 个 id。
 * pool 为空 → []；≤maxCount → 全取（顺序由种子洗牌决定）。
 */
export function pickTodayFeaturedIds(
  catalog: TodayCatalogItem[],
  installed: Iterable<string>,
  careerDay: number,
  maxCount = 3,
): string[] {
  const installedSet = new Set(
    [...installed].map((id) => String(id || "").trim()).filter(Boolean),
  );
  const pool = catalog.filter((item) => {
    const id = String(item.id || "").trim();
    if (!id) return false;
    if (installedSet.has(id)) return false;
    if (String(item.kind || "") === "widget") return false;
    return true;
  });
  if (!pool.length || maxCount <= 0) return [];
  const day = Number.isFinite(careerDay) ? Math.trunc(careerDay) : 0;
  const ranked = pool
    .map((item, index) => ({
      id: String(item.id).trim(),
      rank: hashSeed(`${day}:${item.id}:${index}`),
    }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.id.localeCompare(b.id)));
  return ranked.slice(0, Math.min(maxCount, ranked.length)).map((x) => x.id);
}
