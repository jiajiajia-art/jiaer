/**
 * 统一存档列表项字段：后端 list 返回 summaryPreview，前端 UI 使用 summaryText。
 */
export type SaveListItemLike = {
  saveId?: string;
  summaryText?: string;
  summaryPreview?: string;
  createdAt?: number;
};

export type NormalizedSaveListItem = {
  saveId: string;
  summaryText: string;
  createdAt: number;
};

/** 把接口条目规范成前端列表/预览可用的结构。 */
export function normalizeSaveListItem(raw: SaveListItemLike | null | undefined): NormalizedSaveListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const saveId = String(raw.saveId || '').trim();
  if (!saveId) return null;
  const summaryText = String(raw.summaryText || raw.summaryPreview || '').trim();
  const createdAt = Number(raw.createdAt || 0);
  return {
    saveId,
    summaryText,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

/** 批量规范化；丢弃非法项。 */
export function normalizeSaveListItems(items: unknown): NormalizedSaveListItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeSaveListItem(item as SaveListItemLike))
    .filter((item): item is NormalizedSaveListItem => Boolean(item));
}
