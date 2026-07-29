/**
 * 从属性面板 SSE 的 panels 文本中解析数值卡（对齐图5 数值格展示）。
 * 兼容多行「标签：数字」、emoji 前缀、半角冒号。
 */

export interface AttributeValueCard {
  label: string;
  value: number;
  rawLine: string;
}

/** 功能注释：尽量宽松匹配「…名…：数字」；去 emoji / 装饰后仍保留中文标签。 */
export function parseAttributeValueCards(panelText: string | null | undefined): AttributeValueCard[] {
  const text = String(panelText || '');
  if (!text.trim()) return [];
  const cards: AttributeValueCard[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)[:：]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) continue;
    let label = String(match[1] || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/^[\s·•\-_|/／]+/, '')
      .replace(/[\s·•\-_|/／]+$/, '')
      .trim();
    const value = Number(match[2]);
    if (!label || !Number.isFinite(value)) continue;
    cards.push({ label, value, rawLine: trimmed });
  }
  return cards;
}

/** 功能注释：属性面板只允许「标签：数字」行；防止好感箭头/叙事文本被当成核心属性展示。 */
export function normalizeAttributePanels(
  panels: Record<string, string> | null | undefined
): Record<string, string> {
  if (!panels || typeof panels !== 'object') return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(panels)) {
    const panelKey = String(key || '').trim();
    if (!panelKey) continue;
    const text = String(value || '').trim();
    if (!text) continue;

    if (/属性|attribute/i.test(panelKey)) {
      const numericLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => parseAttributeValueCards(line).length > 0);
      if (numericLines.length > 0) {
        next[panelKey] = numericLines.join('\n');
      }
      continue;
    }

    next[panelKey] = text;
  }
  return next;
}

/**
 * 功能注释：优先取名为「属性」的 tab；否则取首个能解析出数值的 tab。
 */
export function pickAttributeCardsFromPanels(
  panels: Record<string, string> | null | undefined
): { sourceKey: string | null; cards: AttributeValueCard[] } {
  if (!panels || typeof panels !== 'object') {
    return { sourceKey: null, cards: [] };
  }
  const keys = Object.keys(panels);
  const preferred = keys.find((k) => /属性|attribute/i.test(k));
  if (preferred) {
    const cards = parseAttributeValueCards(panels[preferred]);
    if (cards.length > 0) return { sourceKey: preferred, cards };
  }
  for (const key of keys) {
    const cards = parseAttributeValueCards(panels[key]);
    if (cards.length > 0) return { sourceKey: key, cards };
  }
  return { sourceKey: preferred || keys[0] || null, cards: [] };
}

/** 功能注释：面板是否有任意非空文本（用于数值卡失败时仍展示原文）。 */
export function hasNonEmptyPanelText(panels: Record<string, string> | null | undefined): boolean {
  if (!panels || typeof panels !== 'object') return false;
  return Object.values(panels).some((v) => String(v || '').trim().length > 0);
}

/** 功能注释：AbortController 取消属于预期中断，不应写成面板错误文案。 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = String((error as { name?: string }).name || '');
  const message = String((error as { message?: string }).message || '');
  return (
    name === 'AbortError' ||
    message.includes('aborted without reason') ||
    message.includes('The operation was aborted') ||
    message.includes('signal is aborted')
  );
}

/** 功能注释：从 SSE 累计文本中提取 JSON（兼容 code fence / 截断前后缀）。 */
export function extractJsonFromStreamText(text: string): unknown | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* fallthrough */
  }
  try {
    const fence = raw.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
    if (fence?.[1]) return JSON.parse(fence[1].trim());
  } catch {
    /* fallthrough */
  }
  try {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(raw.slice(first, last + 1));
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

/** 功能注释：每轮结束后自动刷属性时的并发/短时去重窗口。 */
export function shouldSkipAttributeAutoRefresh(input: {
  isStreaming: boolean;
  lastStartedAt: number | null;
  now: number;
  minIntervalMs?: number;
}): boolean {
  if (input.isStreaming) return true;
  const minIntervalMs = input.minIntervalMs ?? 2500;
  if (input.lastStartedAt == null) return false;
  return input.now - input.lastStartedAt < minIntervalMs;
}

/**
 * 功能注释：手动刷新/打开面板只读缓存；仅叙事回合后才允许 LLM 重算，避免体力等数值被反复推断改掉。
 */
export type AttributePanelLoadMode = 'cache' | 'regenerate';

export function resolveAttributePanelLoadMode(
  trigger: 'manual-refresh' | 'open' | 'auto-turn'
): AttributePanelLoadMode {
  return trigger === 'auto-turn' ? 'regenerate' : 'cache';
}
