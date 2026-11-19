/**
 * 功能注释：手机应用对话式生成。模型像改代码一样只提交变化：
 * 优先调用 apply_phone_app_edit，接口不支持工具时才退回一个 JSON 补丁。
 * 写入前用 kkapp@1 检查；不通过则整轮不落地，把问题交回模型修一次。
 * 通过后的配置就是现有手机运行器（KkAppRenderer）解释的那一份。
 */
import {
  kkAppFromLegacy,
  kkAppPromptSpec,
  kkAppStarter,
  mergeKkAppPatch,
  normalizeKkApp,
  validateKkApp,
  type KkAppSpec,
} from '../../Romance/src/mods/kkmod/phoneApp.ts';

export type PhoneAppFormType = 'chat' | 'message' | 'browse' | 'read' | 'video' | 'job';

export type PhoneAppFormDraft = {
  name: string;
  summary: string;
  category: string;
  type: PhoneAppFormType;
  contentText: string;
  /** 功能注释：C2.2 对话可产出页面+积木，供 Runner/实时预览 */
  pages?: Array<{
    id?: string;
    name?: string;
    blocks?: Array<{
      id?: string;
      type?: string;
      text?: string;
      title?: string;
      label?: string;
      items?: string[];
    }>;
  }>;
};

export type PhoneAppAiTurn = { role: 'user' | 'assistant'; text: string };

/** 功能注释：与 platformAppsApi.PLATFORM_APP_TYPE_OPTIONS 对齐，避免单测 import 链依赖。 */
export const PHONE_APP_FORM_TYPES: { value: PhoneAppFormType; label: string }[] = [
  { value: 'chat', label: '聊天' },
  { value: 'message', label: '信息' },
  { value: 'browse', label: '浏览' },
  { value: 'read', label: '阅读' },
  { value: 'video', label: '视频' },
  { value: 'job', label: '招聘' },
];

const TYPE_SET = new Set(PHONE_APP_FORM_TYPES.map((o) => o.value));

export const PHONE_APP_EDIT_TOOL_NAME = 'apply_phone_app_edit';

/** 功能注释：给 /api/romance/play/complete 的 OpenAI tools；参数就是 kkapp 补丁，不是另一套积木。 */
export function phoneAppEditTools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
  return [{
    type: 'function',
    function: {
      name: PHONE_APP_EDIT_TOOL_NAME,
      description: '把本轮改动合并进当前手机应用草稿。只写变化的字段。pages 按页面 id 整页替换。只追问、不改草稿时不要调用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '应用名称' },
          summary: { type: 'string', description: '一行说明' },
          category: { type: 'string', description: '分类，如生活、社交' },
          type: { type: 'string', enum: PHONE_APP_FORM_TYPES.map((o) => o.value), description: '应用类型' },
          app: {
            type: 'object',
            description: 'kkapp@1 补丁。pages 只放新增或要整页替换的页；removePages 放要删的页面 id。',
            properties: {
              home: { type: 'string' },
              theme: { type: 'object', properties: { accent: { type: 'string' }, dark: { type: 'boolean' } } },
              removePages: { type: 'array', items: { type: 'string' } },
              pages: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  }];
}

/** 功能注释：系统提示只描述运行器真正执行的 kkapp@1，要求模型调用工具改草稿。 */
export function buildPhoneAppSystemPrompt(draft: PhoneAppFormDraft): string {
  const types = PHONE_APP_FORM_TYPES.map((o) => `${o.value}(${o.label})`).join('、');
  const meta = {
    name: draft.name,
    summary: draft.summary,
    category: draft.category,
    type: draft.type,
  };
  const app = phoneAppSpecFromText(draft.contentText, draft.type, draft.name);
  return `你是 funloom「手机应用」创作者助手。工作方式像改一份已有配置：先看当前草稿，只改用户这一轮提到的页面和字段，不要重写没提到的页。
右侧预览和玩家手机用同一套运行器解释这份 kkapp@1。不要另写一套积木（不要用 type:text / type:list / type:button）。
可用类型：${types}。
${kkAppPromptSpec()}

当前草稿信息：${JSON.stringify(meta)}
当前应用配置：${JSON.stringify(app)}

回复规则：
1. 先用中文说明本轮改了什么、还缺什么（不超过 80 字）。不要在正文里贴配置。
2. 有改动时调用 ${PHONE_APP_EDIT_TOOL_NAME}。只传变化：name、summary、category、type，以及 app.home、app.theme、app.pages（同 id 整页替换）、app.removePages。
3. 积木 kind 只能是 header、text、notice、stats、list、feed、chat、buttons、divider。按钮必须带 action；go 只能指向已有页面或本轮一起提交的页面 id。
4. 只追问、不改草稿时不要调用工具。
若接口不支持工具：改为输出一个 \`\`\`json 代码块，字段与工具参数相同，不要再写 contentText 或另一套 pages。`;
}

/** 功能注释：检查没通过时作为下一轮 user 消息，让模型按同一工具重交，而不是在坏草稿上打补丁。 */
export function buildPhoneAppRepairUser(issues: string[]): string {
  const lines = issues.slice(0, 8).map((x) => `- ${x}`).join('\n');
  return `上一轮修改没有写入草稿，手机应用检查未通过：\n${lines}\n请重新调用 ${PHONE_APP_EDIT_TOOL_NAME}，把这一轮的改动完整再交一次。积木 kind 只能是 header、text、notice、stats、list、feed、chat、buttons、divider；go 必须指向存在的页面 id。`;
}

/** 功能注释：contentText（kkapp JSON 或旧版纯文本）→ 应用配置；空白时给该类型的起步模板 */
export function phoneAppSpecFromText(text: string, type: PhoneAppFormType, name = '应用'): KkAppSpec {
  const raw = String(text || '').trim();
  if (!raw) return kkAppStarter(type, name || '应用');
  try {
    const parsed: unknown = JSON.parse(raw);
    const spec = normalizeKkApp(parsed, type);
    if (spec) return spec;
  } catch {
    /* 旧版纯文本内容 */
  }
  return kkAppFromLegacy(raw, type, name || '应用');
}

/** 功能注释：手改 JSON 的问题清单（空白 / 旧纯文本不报错，保存时自动转换） */
export function phoneAppContentIssues(text: string): string[] {
  const raw = String(text || '').trim();
  if (!raw.startsWith('{')) return [];
  try {
    return validateKkApp(JSON.parse(raw));
  } catch {
    return ['应用配置不是合法 JSON'];
  }
}

export const stringifyPhoneAppSpec = (spec: KkAppSpec) => JSON.stringify(spec, null, 2);

/** 功能注释：从模型正文抠出第一个 JSON 对象（优先 fenced code）。 */
export function extractPhoneAppJsonPatch(text: string): Record<string, unknown> | null {
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : null;
  } catch {
    try {
      const fixed = candidate.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
      const obj = JSON.parse(fixed);
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? (obj as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

function asType(v: unknown, fallback: PhoneAppFormType): PhoneAppFormType {
  const s = String(v || '').trim() as PhoneAppFormType;
  return TYPE_SET.has(s) ? s : fallback;
}

type LooseRec = Record<string, unknown>;

const isRec = (v: unknown): v is LooseRec => !!v && typeof v === 'object' && !Array.isArray(v);

/** 功能注释：旧回复里的 type:text/list/button 收成运行器认识的 kind，避免写进一份跑不起来的第二套页面。 */
function coerceBlock(raw: unknown): unknown {
  if (!isRec(raw)) return raw;
  if (typeof raw.kind === 'string' && raw.kind) return raw;
  if (raw.type === 'list') {
    const items = Array.isArray(raw.items) ? raw.items : [];
    return {
      kind: 'list',
      ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
      items: items.map((item, i) => (
        isRec(item)
          ? item
          : { id: `i${i + 1}`, title: String(item ?? '') }
      )),
    };
  }
  if (raw.type === 'button') {
    const label = String(raw.label || raw.text || '按钮');
    return {
      kind: 'buttons',
      items: [{ id: String(raw.id || 'btn'), label, style: 'primary', action: { toast: label } }],
    };
  }
  const text = String(raw.text || raw.title || '');
  return text ? { kind: 'text', text } : raw;
}

function coercePage(raw: unknown): unknown {
  if (!isRec(raw)) return raw;
  const blocks = Array.isArray(raw.blocks) ? raw.blocks.map(coerceBlock) : raw.blocks;
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title
    : (typeof raw.name === 'string' ? raw.name : raw.title);
  return { ...raw, ...(title ? { title } : {}), ...(blocks ? { blocks } : {}) };
}

/** 功能注释：没有 app 字段时，把顶层 pages 收成 kkapp 补丁；已有 app 时只修正里面的积木。 */
export function coercePhoneAppPatch(patch: LooseRec): LooseRec {
  const app = isRec(patch.app)
    ? patch.app
    : (isRec(patch.content) ? patch.content : null);
  if (app) {
    const pages = Array.isArray(app.pages) ? app.pages.map(coercePage) : app.pages;
    return { ...patch, app: { ...app, ...(pages ? { pages } : {}) } };
  }
  if (!Array.isArray(patch.pages)) return patch;
  const pages = patch.pages.map(coercePage).filter((p) => isRec(p) && Array.isArray(p.blocks) && p.blocks.length);
  if (!pages.length) return patch;
  return { ...patch, app: { pages } };
}

/** 功能注释：按页面 id 合并，但保留原始积木，供检查在规范化丢弃坏块之前看见它们。 */
function rawMergedSpec(base: KkAppSpec, appPatch: LooseRec): unknown {
  const pages: unknown[] = base.pages.map((p) => ({ ...p, blocks: [...p.blocks] }));
  for (const p of Array.isArray(appPatch.pages) ? appPatch.pages : []) {
    if (!isRec(p) || !String(p.id || '').trim()) continue;
    const i = pages.findIndex((x) => isRec(x) && x.id === p.id);
    if (i >= 0) pages[i] = p;
    else pages.push(p);
  }
  const removed = new Set((Array.isArray(appPatch.removePages) ? appPatch.removePages : []).map((x) => String(x)));
  return {
    schema: base.schema,
    type: typeof appPatch.type === 'string' && appPatch.type ? appPatch.type : base.type,
    ...(base.theme || isRec(appPatch.theme) ? { theme: { ...base.theme, ...(isRec(appPatch.theme) ? appPatch.theme : {}) } } : {}),
    home: typeof appPatch.home === 'string' && appPatch.home ? appPatch.home : base.home,
    pages: pages.filter((p) => !(isRec(p) && removed.has(String(p.id || '')))),
  };
}

/** 功能注释：把 AI 补丁合并进草稿。非法 type 回落原值。页面只进 kkapp，不再另存一套积木。 */
export function applyPhoneAppAiPatch(
  draft: PhoneAppFormDraft,
  patch: Record<string, unknown> | null,
): PhoneAppFormDraft {
  if (!patch) return draft;
  const sdk = coercePhoneAppPatch(patch);
  const next: PhoneAppFormDraft = {
    name:
      typeof sdk.name === 'string' && sdk.name.trim()
        ? sdk.name.trim().slice(0, 80)
        : draft.name,
    summary:
      typeof sdk.summary === 'string' ? sdk.summary.trim().slice(0, 200) : draft.summary,
    category:
      typeof sdk.category === 'string' ? sdk.category.trim().slice(0, 40) : draft.category,
    type: 'type' in sdk ? asType(sdk.type, draft.type) : draft.type,
    contentText: mergeContentText(draft, sdk),
  };
  return next;
}

/** 功能注释：app 补丁按页面合并进当前配置；兼容旧模型直接给 contentText / content 的写法 */
function mergeContentText(draft: PhoneAppFormDraft, patch: Record<string, unknown>): string {
  const type = 'type' in patch ? asType(patch.type, draft.type) : draft.type;
  const base = phoneAppSpecFromText(draft.contentText, type, draft.name);
  const appPatch = isRec(patch.app) ? patch.app : undefined;
  if (appPatch) return stringifyPhoneAppSpec(mergeKkAppPatch({ ...base, type }, appPatch));
  if (typeof patch.contentText === 'string') return stringifyPhoneAppSpec(phoneAppSpecFromText(patch.contentText, type, draft.name));
  return draft.contentText;
}

export type PhoneAppToolCall = { name: string; arguments: unknown };

export type PhoneAppModelTurn = { text: string; toolCalls?: PhoneAppToolCall[] };

export type PhoneAppTurnJudgement = {
  draft: PhoneAppFormDraft;
  applied: boolean;
  needsRepair: boolean;
  issues: string[];
  summary: string;
  displayText: string;
};

/** 功能注释：平台 complete 返回的 tool_calls，arguments 可能是 JSON 字符串。解析失败记为 undefined，交由本轮拒绝写入。 */
export function parsePhoneAppToolCalls(raw: unknown): PhoneAppToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const rec = isRec(row) ? row : {};
    const fn = isRec(rec.function) ? rec.function : {};
    const name = String(fn.name || rec.name || '');
    const argsRaw = fn.arguments ?? rec.arguments;
    if (isRec(argsRaw)) return { name, arguments: argsRaw };
    if (typeof argsRaw !== 'string' || !argsRaw.trim()) return { name, arguments: {} };
    try {
      const parsed: unknown = JSON.parse(argsRaw);
      return { name, arguments: isRec(parsed) ? parsed : undefined };
    } catch {
      try {
        const parsed: unknown = JSON.parse(argsRaw.replace(/,\s*([}\]])/g, '$1'));
        return { name, arguments: isRec(parsed) ? parsed : undefined };
      } catch {
        return { name, arguments: undefined };
      }
    }
  }).filter((c) => c.name);
}

function foldEditArgs(parts: LooseRec[]): LooseRec {
  const out: LooseRec = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (key !== 'app' || !isRec(value)) {
        out[key] = value;
        continue;
      }
      const prev = isRec(out.app) ? out.app : {};
      const pages = [...(Array.isArray(prev.pages) ? prev.pages : []), ...(Array.isArray(value.pages) ? value.pages : [])];
      const removePages = [...(Array.isArray(prev.removePages) ? prev.removePages : []), ...(Array.isArray(value.removePages) ? value.removePages : [])];
      out.app = {
        ...prev,
        ...value,
        ...(pages.length ? { pages } : {}),
        ...(removePages.length ? { removePages } : {}),
      };
    }
  }
  return out;
}

/** 功能注释：本轮要合并的补丁。工具参数优先；没有工具时才读正文里的 JSON。坏 JSON 返回 bad。 */
export function phoneAppPatchFromTurn(turn: PhoneAppModelTurn): LooseRec | 'bad' | null {
  const calls = (turn.toolCalls || []).filter((c) => c.name === PHONE_APP_EDIT_TOOL_NAME);
  if (calls.length) {
    if (calls.some((c) => !isRec(c.arguments))) return 'bad';
    return foldEditArgs(calls.map((c) => c.arguments as LooseRec));
  }
  if (/```(?:json)?/i.test(turn.text) && !extractPhoneAppJsonPatch(turn.text)) return 'bad';
  return extractPhoneAppJsonPatch(turn.text);
}

function typeLabel(type: string): string {
  return PHONE_APP_FORM_TYPES.find((o) => o.value === type)?.label || type;
}

/** 功能注释：给聊天气泡的改动摘要，不展示配置原文。 */
export function summarizePhoneAppEdit(before: PhoneAppFormDraft, after: PhoneAppFormDraft): string {
  const parts: string[] = [];
  if (before.name !== after.name && after.name) parts.push(`名称改为「${after.name}」`);
  if (before.summary !== after.summary) parts.push(after.summary ? '更新了说明' : '清空了说明');
  if (before.category !== after.category && after.category) parts.push(`分类改为「${after.category}」`);
  if (before.type !== after.type) parts.push(`类型改为${typeLabel(after.type)}`);
  const titleSeed = before.name || after.name || '应用';
  const prev = phoneAppSpecFromText(before.contentText, before.type, titleSeed);
  const next = phoneAppSpecFromText(after.contentText, after.type, titleSeed);
  if (prev.home !== next.home) parts.push(`首页改为「${next.pages.find((p) => p.id === next.home)?.title || next.home}」`);
  const prevIds = new Set(prev.pages.map((p) => p.id));
  const nextIds = new Set(next.pages.map((p) => p.id));
  for (const page of next.pages) {
    if (!prevIds.has(page.id)) parts.push(`新增页面「${page.title}」`);
    else if (JSON.stringify(prev.pages.find((p) => p.id === page.id)) !== JSON.stringify(page)) parts.push(`改写「${page.title}」`);
  }
  for (const page of prev.pages) {
    if (!nextIds.has(page.id)) parts.push(`删除「${page.title}」`);
  }
  return parts.join('，');
}

function issuesOfPatch(draft: PhoneAppFormDraft, patch: LooseRec): string[] {
  const issues: string[] = [];
  if ('type' in patch && typeof patch.type === 'string' && patch.type.trim() && !TYPE_SET.has(patch.type.trim() as PhoneAppFormType)) {
    issues.push(`类型「${patch.type}」不在手机应用类型里`);
  }
  const sdk = coercePhoneAppPatch(patch);
  if (!isRec(sdk.app)) {
    if (typeof sdk.contentText === 'string' && sdk.contentText.trim().startsWith('{')) {
      try {
        issues.push(...validateKkApp(JSON.parse(sdk.contentText)));
      } catch {
        issues.push('应用配置不是合法 JSON');
      }
    }
    return issues;
  }
  const type = 'type' in sdk ? asType(sdk.type, draft.type) : draft.type;
  const base = phoneAppSpecFromText(draft.contentText, type, draft.name);
  const raw = rawMergedSpec({ ...base, type }, sdk.app);
  const schemaIssues = validateKkApp(raw);
  if (schemaIssues.length) return [...issues, ...schemaIssues];
  if (!normalizeKkApp(raw, type)) issues.push('合并后的应用没有可运行的页面');
  const touched = new Set((Array.isArray(sdk.app.pages) ? sdk.app.pages : []).map((p) => (isRec(p) ? String(p.id || '') : '')));
  issues.push(...missingRuntimeFields(raw, touched));
  return issues;
}

/** 功能注释：规范化会悄悄丢掉缺字段的积木；只检查本轮提交的页，避免旧草稿里的历史问题拦住新改动。 */
function missingRuntimeFields(raw: unknown, touched: Set<string>): string[] {
  if (!isRec(raw) || !Array.isArray(raw.pages)) return [];
  const out: string[] = [];
  for (const page of raw.pages) {
    if (!isRec(page) || !touched.has(String(page.id || '')) || !Array.isArray(page.blocks)) continue;
    const pageName = String(page.title || page.id || '页面');
    for (const block of page.blocks) {
      if (!isRec(block)) continue;
      if ((block.kind === 'text' || block.kind === 'notice') && !String(block.text || '').trim()) {
        out.push(`「${pageName}」有一块空文案`);
      }
      if (block.kind === 'header' && !String(block.title || '').trim()) out.push(`「${pageName}」的标题为空`);
      if (block.kind === 'buttons') {
        const items = Array.isArray(block.items) ? block.items : [];
        if (!items.length || items.some((item) => !isRec(item) || !isRec(item.action))) {
          out.push(`「${pageName}」的按钮缺少 action`);
        }
      }
      if (block.kind === 'list') {
        const items = Array.isArray(block.items) ? block.items : [];
        if (items.some((item) => !isRec(item) || !String(item.title || '').trim())) {
          out.push(`「${pageName}」的列表项缺少 title`);
        }
      }
    }
  }
  return out;
}

/**
 * 功能注释：裁决一轮模型回复。检查不通过时 applied 为 false，草稿保持原样，needsRepair 交给调用方再问一次。
 */
export function judgePhoneAppTurn(draft: PhoneAppFormDraft, turn: PhoneAppModelTurn): PhoneAppTurnJudgement {
  const spoken = stripPhoneAppJsonFence(turn.text);
  const patch = phoneAppPatchFromTurn(turn);
  if (patch === 'bad') {
    const issues = ['提交的修改不是完整 JSON'];
    return {
      draft,
      applied: false,
      needsRepair: true,
      issues,
      summary: '',
      displayText: [spoken, `这轮没有写入草稿：${issues.join('；')}`].filter(Boolean).join('\n\n'),
    };
  }
  if (!patch) {
    return { draft, applied: false, needsRepair: false, issues: [], summary: '', displayText: spoken };
  }
  const issues = issuesOfPatch(draft, patch);
  if (issues.length) {
    return {
      draft,
      applied: false,
      needsRepair: true,
      issues,
      summary: '',
      displayText: [spoken, `这轮没有写入草稿：${issues.slice(0, 4).join('；')}`].filter(Boolean).join('\n\n'),
    };
  }
  const next = applyPhoneAppAiPatch(draft, patch);
  const summary = summarizePhoneAppEdit(draft, next);
  return {
    draft: next,
    applied: true,
    needsRepair: false,
    issues: [],
    summary,
    displayText: [spoken || '已写入草稿。', summary].filter(Boolean).join('\n\n'),
  };
}

/** 功能注释：去掉 assistant 可见 JSON 块，只留说明文案展示在聊天气泡。 */
export function stripPhoneAppJsonFence(text: string): string {
  return String(text || '')
    .replace(/```(?:json)?[\s\S]*?```/gi, '')
    .trim();
}
