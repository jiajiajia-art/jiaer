/**
 * 从属性面板 SSE 的 panels 文本中解析数值卡（对齐图5 数值格展示）。
 * 兼容多行「标签：数字」、emoji 前缀、半角冒号、以及文档常见「70/100」「70/100（说明）」。
 * 「属性数值」模块只展示玩家自身属性，禁止 NPC 好感行。
 */

export interface AttributeValueCard {
  label: string;
  value: number;
  rawLine: string;
}

export type AttributePanelsPickOptions = {
  /** NPC 名：用于从「属性」数值卡中剔除误写入的人名行 */
  npcNames?: Array<string | null | undefined> | null;
};

/** 功能注释：是否为玩家「属性」面板键（排除好感/关系）。 */
export function isPlayerAttributePanelKey(key: string | null | undefined): boolean {
  const k = String(key || '').trim();
  if (!k) return false;
  if (!/属性|attribute/i.test(k)) return false;
  if (/好感|affection|favor|关系|relation/i.test(k)) return false;
  return true;
}

export function normalizeNpcAttributeLabelKey(name: string | null | undefined): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[·・•．.]/g, '');
}

export function collectNpcAttributeLabelKeys(
  npcNames?: Array<string | null | undefined> | null,
): Set<string> {
  const keys = new Set<string>();
  for (const raw of Array.isArray(npcNames) ? npcNames : []) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const primary = normalizeNpcAttributeLabelKey(name);
    if (primary) keys.add(primary);
    const paren = name.match(/[（(]([^）)]+)[）)]/);
    if (paren?.[1]) {
      const nick = normalizeNpcAttributeLabelKey(paren[1]);
      if (nick) keys.add(nick);
    }
  }
  return keys;
}

/**
 * 功能注释：单行是否为可解析的属性数值行（与 parseAttributeValueCards 规则一致）。
 * 允许：容貌：70｜容貌：70/100｜容貌：70/100（中上之姿）｜心情：+5
 * 拒绝：周念：↑↑↑｜纯叙事句
 */
export function isParseableAttributeValueLine(line: string | null | undefined): boolean {
  return parseAttributeValueCards(String(line || '')).length > 0;
}

/** 功能注释：尽量宽松匹配「…名…：数字」；去 emoji / 装饰后仍保留中文标签。 */
export function parseAttributeValueCards(panelText: string | null | undefined): AttributeValueCard[] {
  const text = String(panelText || '');
  if (!text.trim()) return [];
  const cards: AttributeValueCard[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 标签：数值，可选 /满分，可选全角/半角括注或尾随空格
    const match = trimmed.match(
      /^(.+?)[:：]\s*\+?(-?\d+(?:\.\d+)?)(?:\s*\/\s*\d+(?:\.\d+)?)?(?:\s*[（(][^）)]*[）)])?\s*$/,
    );
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

/**
 * 功能注释：从玩家属性面板文本中去掉 NPC 人名行。
 */
export function filterPlayerAttributePanelText(
  panelText: string | null | undefined,
  npcNames?: Array<string | null | undefined> | null,
): string {
  const npcKeys = collectNpcAttributeLabelKeys(npcNames);
  const lines = String(panelText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (npcKeys.size === 0) {
    return lines.filter((line) => isParseableAttributeValueLine(line)).join('\n');
  }
  const kept: string[] = [];
  for (const line of lines) {
    if (!isParseableAttributeValueLine(line)) continue;
    const card = parseAttributeValueCards(line)[0];
    if (!card) continue;
    const labelKey = normalizeNpcAttributeLabelKey(card.label);
    if (labelKey && npcKeys.has(labelKey)) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

/**
 * 功能注释：把误写在「属性」里的 NPC 行挪到「好感」。
 */
export function relocateNpcLinesOutOfPlayerAttributePanels(
  panels: Record<string, string> | null | undefined,
  npcNames?: Array<string | null | undefined> | null,
): Record<string, string> {
  if (!panels || typeof panels !== 'object') return {};
  const npcKeys = collectNpcAttributeLabelKeys(npcNames);
  const next: Record<string, string> = { ...panels };
  const favorLinesToAdd: string[] = [];

  for (const [key, value] of Object.entries(panels)) {
    if (!isPlayerAttributePanelKey(key)) continue;
    const text = String(value || '').trim();
    if (!text || npcKeys.size === 0) continue;
    const keep: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const card = parseAttributeValueCards(trimmed)[0];
      if (!card) {
        keep.push(trimmed);
        continue;
      }
      const labelKey = normalizeNpcAttributeLabelKey(card.label);
      if (labelKey && npcKeys.has(labelKey)) {
        favorLinesToAdd.push(card.rawLine);
        continue;
      }
      keep.push(trimmed);
    }
    if (keep.length > 0) next[key] = keep.join('\n');
    else delete next[key];
  }

  if (favorLinesToAdd.length > 0) {
    const favorKey = Object.keys(next).find((k) => /好感|affection|favor/i.test(k)) || '好感';
    const existing = String(next[favorKey] || '').trim();
    const merged: string[] = [];
    const seen = new Set<string>();
    for (const line of [...(existing ? existing.split(/\r?\n/) : []), ...favorLinesToAdd]) {
      const t = line.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      merged.push(t);
    }
    next[favorKey] = merged.join('\n');
  }

  return next;
}

/** 功能注释：属性面板只允许「标签：数字」行；防止好感箭头/叙事文本被当成核心属性展示。 */
export function normalizeAttributePanels(
  panels: Record<string, string> | null | undefined,
  options?: AttributePanelsPickOptions,
): Record<string, string> {
  if (!panels || typeof panels !== 'object') return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(panels)) {
    const panelKey = String(key || '').trim();
    if (!panelKey) continue;
    const text = String(value || '').trim();
    if (!text) continue;

    if (isPlayerAttributePanelKey(panelKey) || /属性|attribute/i.test(panelKey)) {
      // 先只保留数字行；NPC 人名行交给 relocate 挪到「好感」
      const numericLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => isParseableAttributeValueLine(line));
      if (numericLines.length > 0) {
        next[panelKey] = numericLines.join('\n');
      }
      continue;
    }

    next[panelKey] = text;
  }
  return relocateNpcLinesOutOfPlayerAttributePanels(next, options?.npcNames);
}

/**
 * 功能注释：只取玩家「属性」tab 的数值卡；永不回落到「好感」等人名面板。
 */
export function pickAttributeCardsFromPanels(
  panels: Record<string, string> | null | undefined,
  options?: AttributePanelsPickOptions,
): { sourceKey: string | null; cards: AttributeValueCard[] } {
  if (!panels || typeof panels !== 'object') {
    return { sourceKey: null, cards: [] };
  }
  const npcKeys = collectNpcAttributeLabelKeys(options?.npcNames);
  const keys = Object.keys(panels).filter(isPlayerAttributePanelKey);
  const preferred = keys.find((k) => /^属性$|^attribute$/i.test(k)) || keys[0] || null;
  const ordered = preferred
    ? [preferred, ...keys.filter((k) => k !== preferred)]
    : keys;

  for (const key of ordered) {
    const cards = parseAttributeValueCards(panels[key]).filter((card) => {
      const labelKey = normalizeNpcAttributeLabelKey(card.label);
      return !(labelKey && npcKeys.has(labelKey));
    });
    if (cards.length > 0) return { sourceKey: key, cards };
  }
  return { sourceKey: preferred, cards: [] };
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

/** 功能注释：每轮结束后自动刷属性时的并发/短时去重窗口；主线叙事占用 epone 时也跳过。 */
export function shouldSkipAttributeAutoRefresh(input: {
  isStreaming: boolean;
  lastStartedAt: number | null;
  now: number;
  minIntervalMs?: number;
  /** 主线 stream/压缩进行中：勿与叙事抢同一 DeepSeek/epone 配额 */
  narrativeBusy?: boolean;
}): boolean {
  if (input.narrativeBusy) return true;
  if (input.isStreaming) return true;
  const minIntervalMs = input.minIntervalMs ?? 2500;
  if (input.lastStartedAt == null) return false;
  return input.now - input.lastStartedAt < minIntervalMs;
}

/**
 * 功能注释：有缓存时手动刷新/打开只读库，避免数值被反复推断改掉；
 * 无缓存时手动刷新应走 LLM；回合结束后始终 regenerate。
 */
export type AttributePanelLoadMode = 'cache' | 'regenerate';

export function resolveAttributePanelLoadMode(
  trigger: 'manual-refresh' | 'open' | 'auto-turn',
  options?: { hasCachedPanels?: boolean }
): AttributePanelLoadMode {
  if (trigger === 'auto-turn') return 'regenerate';
  if (trigger === 'manual-refresh' && options?.hasCachedPanels === false) return 'regenerate';
  return 'cache';
}
