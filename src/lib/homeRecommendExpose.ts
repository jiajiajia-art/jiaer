/**
 * 从推荐列表中提取需上报曝光的 campaign 卡片（纯函数，供 Home 与单测共用）
 */

export type RecommendExposeGame = {
  fileId?: string;
  file_id?: string;
  campaignId?: number | null;
  campaign_id?: number | null;
};

export type RecommendExposeItem = {
  fileId: string;
  campaignId: number;
};

export function collectRecommendExposeItems(
  games: RecommendExposeGame[] | null | undefined = [],
): RecommendExposeItem[] {
  const seen = new Set<string>();
  const items: RecommendExposeItem[] = [];
  for (const g of games || []) {
    const fileId = String(g?.fileId || g?.file_id || '').trim();
    const campaignId = Number(g?.campaignId ?? g?.campaign_id ?? 0);
    if (!fileId || !Number.isFinite(campaignId) || campaignId <= 0) continue;
    const key = `${fileId}:${campaignId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ fileId, campaignId });
  }
  return items;
}

export default { collectRecommendExposeItems };
