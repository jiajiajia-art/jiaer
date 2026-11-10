/**
 * 功能注释：手机应用对话式生成 — 解析 AI 回复里的 JSON 补丁，合并进表单草稿。
 * 与玩法 Mod「对话改模组」同思路：先说明，再 ```json 代码块。
 * 应用内容是 kkapp@1 配置（手机应用 SDK，与 Romance 运行时共用），contentText 存它的 JSON 文本，可手改。
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

/** 功能注释：系统提示，约束模型只产出可写入平台应用表的字段。 */
export function buildPhoneAppSystemPrompt(draft: PhoneAppFormDraft): string {
  const types = PHONE_APP_FORM_TYPES.map((o) => `${o.value}(${o.label})`).join('、');
  const { contentText, ...meta } = draft;
  const app = phoneAppSpecFromText(contentText, draft.type, draft.name);
  return `你是 funloom「手机应用」创作者助手。用户用对话描述想做的手机应用，你帮他生成一个可交互的应用：页面、列表、按钮，以及按钮对作品属性 / 金钱 / 关系的影响。
可用类型：${types}。
${kkAppPromptSpec()}

当前草稿信息：${JSON.stringify(meta)}
当前应用配置：${JSON.stringify(app)}

回复规则：
1. 先用中文简短说明本轮改了什么、还缺什么（不超过 120 字）。
2. 若有改动，再输出一个 \`\`\`json 代码块，字段可省略：{"name":"","summary":"一行说明","category":"分类","type":"browse|chat|message|read|video|job","app":{"home"?,"theme"?,"pages":[只写新增或改动的整页，同 id 整页替换],"removePages"?:["要删的页面id"]}}。
3. 只追问、不改动时可不输出代码块。不要写可执行代码。`;
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

/** 功能注释：把 AI 补丁合并进草稿；非法 type 回落原值。 */
export function applyPhoneAppAiPatch(
  draft: PhoneAppFormDraft,
  patch: Record<string, unknown> | null,
): PhoneAppFormDraft {
  if (!patch) return draft;
  return {
    name:
      typeof patch.name === 'string' && patch.name.trim()
        ? patch.name.trim().slice(0, 80)
        : draft.name,
    summary:
      typeof patch.summary === 'string' ? patch.summary.trim().slice(0, 200) : draft.summary,
    category:
      typeof patch.category === 'string' ? patch.category.trim().slice(0, 40) : draft.category,
    type: 'type' in patch ? asType(patch.type, draft.type) : draft.type,
    contentText: mergeContentText(draft, patch),
  };
}

/** 功能注释：app 补丁按页面合并进当前配置；兼容旧模型直接给 contentText / content 的写法 */
function mergeContentText(draft: PhoneAppFormDraft, patch: Record<string, unknown>): string {
  const type = 'type' in patch ? asType(patch.type, draft.type) : draft.type;
  const base = phoneAppSpecFromText(draft.contentText, type, draft.name);
  const appPatch = patch.app ?? (patch.content && typeof patch.content === 'object' ? patch.content : undefined);
  if (appPatch && typeof appPatch === 'object') return stringifyPhoneAppSpec(mergeKkAppPatch({ ...base, type }, appPatch));
  if (typeof patch.contentText === 'string') return stringifyPhoneAppSpec(phoneAppSpecFromText(patch.contentText, type, draft.name));
  return draft.contentText;
}

/** 功能注释：去掉 assistant 可见 JSON 块，只留说明文案展示在聊天气泡。 */
export function stripPhoneAppJsonFence(text: string): string {
  return String(text || '')
    .replace(/```(?:json)?[\s\S]*?```/gi, '')
    .trim();
}
