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
  deadlineAt?: string;
  deadlineText?: string;
  deadlineSource?: string;
  updatedAt?: string;
}

const ALLOWED_STATUS = new Set(['active', 'completed', 'failed', 'optional', 'in_progress', '进行中', '可选']);
const TERMINAL_QUEST_STATUS = new Set(['completed', 'failed']);
const ACTIVE_QUEST_STATUS = new Set(['active', 'in_progress', '进行中', 'optional', '可选']);

function normalizeQuestStatus(status: unknown): QuestStatus {
  let normalized = String(status || 'active').trim() || 'active';
  if (normalized === 'in_progress' || normalized === '进行中') normalized = 'active';
  if (normalized === '可选') normalized = 'optional';
  return normalized;
}

function trimText(value: unknown, max = 200): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * 功能注释：问题2——清洗任务追踪出戏用词（「向游戏询问…」），改成剧情内目标。
 */
export function sanitizeQuestObjectiveText(text: unknown): string {
  let out = String(text || '').trim();
  if (!out) return '';

  out = out
    .replace(/向(?:游戏|系统|GM|Gm|主持人|叙事(?:者)?|引擎)(?:询问|打听|了解|确认|查询|咨询)/g, '弄清')
    .replace(/(?:询问|打听|了解|咨询)(?:游戏|系统|GM|主持人)(?:关于|有关)?/g, '弄清')
    .replace(/向游戏|问游戏|找游戏|对游戏说/g, '')
    .replace(/当前的详细情况|目前的详细情况/g, '当前处境')
    .replace(/详细情况/g, '眼下情况')
    .replace(/查看任务(?:进度|列表|追踪)?/g, '推进当前目标')
    .replace(/打开任务面板/g, '理清下一步目标')
    .replace(/[ \t\u00a0]+/g, '')
    .replace(/^[,，、。.!！？?\s]+|[,，、。.!！？?\s]+$/g, '')
    .trim();

  if (!out || /^(弄清|了解|确认)$/.test(out)) {
    return '弄清当前处境';
  }
  return out.replace(/弄清弄清/g, '弄清');
}

/** 功能注释：清洗单条任务；缺 id/title 则丢弃。 */
export function normalizeQuestItem(raw: unknown, index = 0): QuestItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const titleRaw = String(q.title || '').trim();
  if (!titleRaw) return null;
  const title = sanitizeQuestObjectiveText(titleRaw) || titleRaw;
  const id = String(q.id || '').trim() || `quest-${index}-${title.slice(0, 24)}`;
  const type = String(q.type || 'side').trim() || 'side';
  const status = normalizeQuestStatus(q.status);
  if (!ALLOWED_STATUS.has(status) && status !== 'active') {
    // 未知状态仍保留原文，便于展示
  }
  const descriptionRaw = String(q.description || '').trim();
  const goalRaw = String(q.goalText || q.goal || '').trim();
  return {
    id,
    title,
    type,
    status,
    description: descriptionRaw ? (sanitizeQuestObjectiveText(descriptionRaw) || descriptionRaw) : '',
    goalText: goalRaw ? (sanitizeQuestObjectiveText(goalRaw) || goalRaw) : '',
    tracked: q.tracked === true,
    deadlineAt: trimText(q.deadlineAt, 40) || undefined,
    deadlineText: trimText(q.deadlineText || q.deadlineLabel, 120) || undefined,
    deadlineSource: trimText(q.deadlineSource, 20) || undefined,
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

function mergeQuestFields(previous: QuestItem | undefined, incoming: QuestItem): QuestItem {
  const merged: QuestItem = {
    ...(previous || incoming),
    ...incoming,
  };

  if (previous && TERMINAL_QUEST_STATUS.has(String(previous.status)) && ACTIVE_QUEST_STATUS.has(String(incoming.status))) {
    merged.status = previous.status;
    merged.tracked = false;
  }

  if (previous?.deadlineAt && !incoming.deadlineAt) {
    merged.deadlineAt = previous.deadlineAt;
  }
  if (previous?.deadlineText && !incoming.deadlineText) {
    merged.deadlineText = previous.deadlineText;
  }
  if (previous?.deadlineSource && !incoming.deadlineSource) {
    merged.deadlineSource = previous.deadlineSource;
  }

  if (TERMINAL_QUEST_STATUS.has(String(merged.status))) {
    merged.tracked = false;
  }

  return merged;
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
  for (const q of next) {
    map.set(q.id, mergeQuestFields(map.get(q.id), q));
  }

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
  const deadline = formatQuestDeadlineDisplay(quest);
  const goal = quest.goalText || quest.description || quest.title;
  return deadline ? `${goal}（${deadline}）` : goal;
}

/** 功能注释：展示用 deadline 文案，优先原话再 fallback 到标准时间。 */
export function formatQuestDeadlineDisplay(quest: QuestItem | null | undefined): string {
  if (!quest) return '';
  const text = trimText(quest.deadlineText, 80);
  const at = trimText(quest.deadlineAt, 40);
  if (text && at) return `${text} / ${at}`;
  return text || at;
}

export type QuestAutoRefreshGate = {
  isStreaming: boolean;
  lastStartedAt: number | null;
  now?: number;
  minIntervalMs?: number;
  /** 主线 stream/压缩进行中：勿与叙事抢同一 DeepSeek/epone 配额 */
  narrativeBusy?: boolean;
};

/** 功能注释：任务后台刷新节流，避免与属性刷新/主线叙事同时打爆 LLM。 */
export function shouldSkipQuestAutoRefresh({
  isStreaming,
  lastStartedAt,
  now = Date.now(),
  minIntervalMs = 2500,
  narrativeBusy = false,
}: QuestAutoRefreshGate): boolean {
  if (narrativeBusy) return true;
  if (isStreaming) return true;
  if (!lastStartedAt) return false;
  return now - lastStartedAt < minIntervalMs;
}

export type QuestsPanelRefreshPlan = {
  /** 本地/play-ui 已有任务，可先渲染 */
  hasCache: boolean;
  /** 仅无缓存时用阻塞 loading；有缓存时 LLM 后台跑 */
  blockingLoader: boolean;
  /** 打开面板时仍异步跑 LLM，结果 merge 追加/更新 */
  runLlmAsync: boolean;
};

/**
 * 打开任务日志：有缓存先展示；LLM 一律异步，回来用 mergeQuests 追加/更新。
 */
export function resolveQuestsPanelRefreshPlan(
  localQuests: QuestItem[] | null | undefined,
): QuestsPanelRefreshPlan {
  const hasCache = normalizeQuests(localQuests).length > 0;
  return {
    hasCache,
    blockingLoader: !hasCache,
    runLlmAsync: true,
  };
}
