/**
 * 系统面板世界书：创作台 morePromptForms ↔ 开局 worldBookEntries，及导入解析。
 */

import type { GameStartWorldBookEntry } from './gameStartConfig';
import type { MorePromptFormLike, SystemPanelItem } from './systemPanelFromMorePromptForms';

const CONTENT_SUMMARY_MAX = 120;

function trimStr(v: unknown): string {
  return String(v ?? '').trim();
}

function keysFromTitle(title: string): string[] {
  return String(title || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function truncateSummary(content: string): string {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (Array.from(text).length <= CONTENT_SUMMARY_MAX) return text;
  return `${Array.from(text).slice(0, CONTENT_SUMMARY_MAX).join('')}…`;
}

function newEntryId() {
  return `wb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 功能注释：创作台补充提示词 → 局内可编辑世界书条目。 */
export function morePromptFormsToWorldBookEntries(forms: unknown): GameStartWorldBookEntry[] {
  if (!Array.isArray(forms)) return [];
  type Row = { order: number; entry: GameStartWorldBookEntry };
  const rows: Row[] = [];
  forms.forEach((raw, index) => {
    const form = raw as MorePromptFormLike;
    if (!form || typeof form !== 'object') return;
    const keywordsTitle = trimStr(form.title);
    const description = trimStr(form.description);
    const content = trimStr(form.content);
    if (!description && !keywordsTitle && !content) return;
    const order = Number.isFinite(Number(form.order)) ? Number(form.order) : index;
    rows.push({
      order,
      entry: {
        id: trimStr(form.id) || `system-${index}`,
        title: description || keywordsTitle || `条目 ${index + 1}`,
        content,
        keywords: keysFromTitle(keywordsTitle),
        constant: form.constant !== false,
        enabled: form.enabled !== false,
      },
    });
  });
  rows.sort((a, b) => a.order - b.order);
  return rows.map((r) => r.entry);
}

/** 功能注释：世界书条目 → 列表卡片（含停用项，供开关展示）。 */
export function worldBookEntriesToPanelItems(entries: GameStartWorldBookEntry[]): SystemPanelItem[] {
  return (entries || []).map((e, index) => ({
    id: trimStr(e.id) || `wb-${index}`,
    name: trimStr(e.title) || `条目 ${index + 1}`,
    summary: truncateSummary(e.content || ''),
    keywords: Array.isArray(e.keywords) ? e.keywords.map(trimStr).filter(Boolean) : [],
    constant: e.constant === true,
    enabled: e.enabled !== false,
  }));
}

export function createEmptyWorldBookEntry(): GameStartWorldBookEntry {
  return {
    id: newEntryId(),
    title: '',
    content: '',
    keywords: [],
    constant: false,
    enabled: true,
  };
}

export function normalizeWorldBookEntry(
  raw: Partial<GameStartWorldBookEntry> | null | undefined,
): { ok: true; entry: GameStartWorldBookEntry } | { ok: false; message: string } {
  const title = trimStr(raw?.title);
  const content = trimStr(raw?.content);
  if (!title) return { ok: false, message: '请填写标题' };
  if (title.length > 40) return { ok: false, message: '标题不能超过40字' };
  if (content.length > 8000) return { ok: false, message: '内容过长' };
  let keywords: string[] = [];
  if (Array.isArray(raw?.keywords)) {
    keywords = raw!.keywords!.map(trimStr).filter(Boolean);
  }
  const keywordsJoined = keywords.join('，');
  if (keywordsJoined.length > 100) return { ok: false, message: '触发关键词不能超过100字' };
  return {
    ok: true,
    entry: {
      id: trimStr(raw?.id) || newEntryId(),
      title,
      content,
      keywords,
      constant: Boolean(raw?.constant),
      enabled: raw?.enabled !== false,
    },
  };
}

function coerceEntry(raw: unknown, index: number): GameStartWorldBookEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  // SillyTavern / 常见导出：name/keys/content 或 title/keywords
  const title = trimStr(o.title || o.name || o.description || `导入条目 ${index + 1}`);
  const content = trimStr(o.content || o.entry || o.text || '');
  let keywords: string[] = [];
  if (Array.isArray(o.keywords)) {
    keywords = o.keywords.map((k) => trimStr(k)).filter(Boolean);
  } else if (Array.isArray(o.key)) {
    keywords = o.key.map((k) => trimStr(k)).filter(Boolean);
  } else if (Array.isArray(o.keys)) {
    keywords = o.keys.map((k) => trimStr(k)).filter(Boolean);
  } else if (typeof o.key === 'string') {
    keywords = keysFromTitle(o.key);
  } else if (typeof o.title === 'string' && !o.name) {
    // 创作台形态：title 存关键词
    const desc = trimStr(o.description);
    if (desc) {
      return {
        id: trimStr(o.id) || newEntryId(),
        title: desc,
        content,
        keywords: keysFromTitle(String(o.title)),
        constant: Boolean(o.constant),
        enabled: o.enabled !== false && o.disable !== true,
      };
    }
  }
  if (!title && !content) return null;
  return {
    id: trimStr(o.id) || newEntryId(),
    title: title || `导入条目 ${index + 1}`,
    content,
    keywords,
    constant: Boolean(o.constant || o.always),
    enabled: o.enabled !== false && o.disable !== true,
  };
}

/**
 * 功能注释：解析粘贴/上传的世界书 JSON（数组、{entries}、创作台 morePromptForms）。
 */
export function parseWorldBookImportText(text: string): {
  ok: boolean;
  message?: string;
  entries: GameStartWorldBookEntry[];
} {
  const raw = trimStr(text);
  if (!raw) return { ok: false, message: '请粘贴世界书内容', entries: [] };

  // 纯文本：按空行切成多条
  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    const blocks = raw.split(/\n\s*\n/).map(trimStr).filter(Boolean);
    if (blocks.length === 0) return { ok: false, message: '未识别到可导入内容', entries: [] };
    return {
      ok: true,
      entries: blocks.map((block, i) => {
        const lines = block.split('\n').map(trimStr).filter(Boolean);
        const title = lines[0]?.slice(0, 40) || `导入条目 ${i + 1}`;
        const content = lines.slice(1).join('\n') || lines[0] || '';
        return {
          id: newEntryId(),
          title,
          content,
          keywords: [],
          constant: false,
          enabled: true,
        };
      }),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'JSON 解析失败，请检查格式', entries: [] };
  }

  let list: unknown[] = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.entries)) list = o.entries;
    else if (Array.isArray(o.worldBookEntries)) list = o.worldBookEntries;
    else if (Array.isArray(o.morePromptForms)) list = o.morePromptForms;
    else if (Array.isArray(o.data)) list = o.data;
    else return { ok: false, message: 'JSON 中未找到条目数组', entries: [] };
  }

  const entries = list
    .map((item, i) => coerceEntry(item, i))
    .filter((e): e is GameStartWorldBookEntry => Boolean(e));

  if (entries.length === 0) {
    return { ok: false, message: '没有可导入的有效条目', entries: [] };
  }
  return { ok: true, entries };
}

/** 内置模板（「从已有模板导入」）。 */
export const WORLD_BOOK_IMPORT_TEMPLATES: readonly {
  id: string;
  name: string;
  description: string;
  entries: GameStartWorldBookEntry[];
}[] = Object.freeze([
  {
    id: 'court_basic',
    name: '宫廷常识',
    description: '礼仪、称谓与宫规摘要',
    entries: [
      {
        id: 'tpl_court_1',
        title: '宫廷称谓',
        content: '对皇帝称陛下，对后妃按位份称呼；私下不可直呼名讳。',
        keywords: ['陛下', '娘娘', '皇子'],
        constant: true,
        enabled: true,
      },
      {
        id: 'tpl_court_2',
        title: '宫规摘要',
        content: '无诏不得擅入内廷；夜行需腰牌。违者按律议处。',
        keywords: ['宫规', '腰牌', '内廷'],
        constant: false,
        enabled: true,
      },
    ],
  },
  {
    id: 'jianghu_basic',
    name: '江湖门派',
    description: '门派规矩与恩怨基调',
    entries: [
      {
        id: 'tpl_jh_1',
        title: '门派规矩',
        content: '同门相残为江湖大忌；比武点到为止，不可下死手。',
        keywords: ['门派', '比武', '同门'],
        constant: true,
        enabled: true,
      },
    ],
  },
]);
