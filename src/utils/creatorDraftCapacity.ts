/** 与后端 CREATOR_DRAFT_LIMIT 对齐的产品上限（展示与提示用；硬门槛仍以服务端为准）。 */
export const CREATOR_DRAFT_LIMIT = 30;

/**
 * 功能注释：已满提示必须带 count/limit，避免草稿箱首屏只露两张卡时误判「明明没满」。
 */
export function formatDraftLimitReachedMessage(
  count: number,
  limit: number = CREATOR_DRAFT_LIMIT,
): string {
  const used = Math.max(0, Number(count) || 0);
  const max = Math.max(1, Number(limit) || CREATOR_DRAFT_LIMIT);
  return `草稿已满（${used}/${max}），先发布或删除一部`;
}

/** 功能注释：根据服务端 capacity 判断是否还能新建；缺字段时不当作已满。 */
export function isDraftCapacityFull(capacity?: {
  canCreate?: boolean;
  count?: number;
  limit?: number;
} | null): boolean {
  if (!capacity || typeof capacity !== 'object') return false;
  if (typeof capacity.canCreate === 'boolean') return !capacity.canCreate;
  const limit = Number(capacity.limit);
  const count = Number(capacity.count);
  if (!Number.isFinite(limit) || !Number.isFinite(count)) return false;
  return count >= limit;
}
