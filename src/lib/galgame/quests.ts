/**
 * 结构化任务 quests[]：规范化、合并、取追踪主线。
 */

export type QuestType = 'main' | 'side' | 'optional' | string;
export type QuestStatus = 'active' | 'completed' | 'failed' | 'optional' | string;

export interface QuestItem {
  id: string;
  title: string;
  type: QuestType;
  status: QuestStatus;
  description: string;
  goalText: string;
  tracked: boolean;
  updatedAt?: string;
}

const ALLOWED_STATUS = new Set(['active', 'completed', 'failed', 'optional', 'in_progress', '进行中', '可选']);

/** 功能注释：清洗单条任务；缺 id/title 则丢弃。 */
export function normalizeQuestItem(raw: unknown, index = 0): QuestItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const title = String(q.title || '').trim();
  if (!title) return null;
  const id = String(q.id || '').trim() || `quest-${index}-${title.slice(0, 24)}`;
  const type = String(q.type || 'side').trim() || 'side';
  let status = String(q.status || 'active').trim() || 'active';
  if (status === 'in_progress' || status === '进行中') status = 'active';
  if (status === '可选') status = 'optional';
  if (!ALLOWED_STATUS.has(status) && status !== 'active') {
    // 未知状态仍保留原文，便于展示
  }
  return {
    id,
    title,
    type,
    status,
    description: String(q.description || '').trim(),
    goalText: String(q.goalText || q.goal || '').trim(),
    tracked: q.tracked === true,
    updatedAt: q.updatedAt ? String(q.updatedAt) : undefined,
  };
}

export function normalizeQuests(raw: unknown): QuestItem[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestItem[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    const normalized = normalizeQuestItem(item, index);
    if (!normalized) return;
    if (seen.has(normalized.id)) return;
    seen.add(normalized.id);
    out.push(normalized);
  });
  return out;
}

/**
 * 功能注释：用最新列表覆盖同 id；新 id 追加；保证最多一个 tracked=true（优先新列表里最后一个 tracked）。
 */
export function mergeQuests(
  previous: QuestItem[] | null | undefined,
  incoming: unknown
): QuestItem[] {
  const prev = normalizeQuests(previous || []);
  const next = normalizeQuests(incoming);
  if (next.length === 0) return prev;

  const map = new Map<string, QuestItem>();
  for (const q of prev) map.set(q.id, q);
  for (const q of next) map.set(q.id, { ...map.get(q.id), ...q });

  let list = Array.from(map.values());
  const trackedIds = list.filter((q) => q.tracked).map((q) => q.id);
  if (trackedIds.length > 1) {
    const keep = trackedIds[trackedIds.length - 1];
    list = list.map((q) => ({ ...q, tracked: q.id === keep }));
  }
  return list;
}

/** 功能注释：顶栏任务追踪文案；优先 tracked，否则首个 active 主线。 */
export function getTrackedQuest(quests: QuestItem[] | null | undefined): QuestItem | null {
  const list = normalizeQuests(quests || []);
  const tracked = list.find((q) => q.tracked);
  if (tracked) return tracked;
  const mainActive = list.find(
    (q) => (q.type === 'main' || q.type === '主线') && (q.status === 'active' || q.status === 'optional')
  );
  return mainActive || list.find((q) => q.status === 'active') || null;
}

export function getQuestTrackerLabel(quest: QuestItem | null): string {
  if (!quest) return '';
  return quest.goalText || quest.description || quest.title;
}
