/**
 * 功能注释：手机应用对话式生成 — 解析 AI 回复里的 JSON 补丁，合并进表单草稿。
 * 与玩法 Mod「对话改模组」同思路：先说明，再 ```json 代码块。
 */

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

/** 功能注释：系统提示，约束模型只产出可写入平台应用表的字段。 */
export function buildPhoneAppSystemPrompt(draft: PhoneAppFormDraft): string {
  const types = PHONE_APP_FORM_TYPES.map((o) => `${o.value}(${o.label})`).join('、');
  return `你是 funloom「手机应用」创作者助手。用户用对话描述想做的手机应用，你帮他生成可运行的应用草稿（页面+积木），创作页会实时预览。
可用类型：${types}。
当前草稿：${JSON.stringify(draft)}

回复规则：
1. 先用中文简短说明本轮改了什么、还缺什么（不超过 120 字）。
2. 若有改动，再输出一个 \`\`\`json 代码块，字段可省略：{"name":"","summary":"一行说明","category":"分类","type":"browse|chat|message|read|video|job","contentText":"摘要文案","pages":[{"id":"home","name":"首页","blocks":[{"id":"b1","type":"text","text":"..."},{"id":"b2","type":"list","title":"列表","items":["a","b"]}]}]}}。
3. 说「加一页」时必须在 pages 里追加新页；积木 type 限 text/list/button。不要写可执行代码。
4. 只追问、不改动时可不输出代码块。`;
}

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

/** 功能注释：把 AI 补丁合并进草稿；非法 type 回落原值；pages 按整表替换（有则用）。 */
export function applyPhoneAppAiPatch(
  draft: PhoneAppFormDraft,
  patch: Record<string, unknown> | null,
): PhoneAppFormDraft {
  if (!patch) return draft;
  const next: PhoneAppFormDraft = {
    name:
      typeof patch.name === 'string' && patch.name.trim()
        ? patch.name.trim().slice(0, 80)
        : draft.name,
    summary:
      typeof patch.summary === 'string' ? patch.summary.trim().slice(0, 200) : draft.summary,
    category:
      typeof patch.category === 'string' ? patch.category.trim().slice(0, 40) : draft.category,
    type: 'type' in patch ? asType(patch.type, draft.type) : draft.type,
    contentText:
      typeof patch.contentText === 'string'
        ? patch.contentText
        : typeof patch.content === 'string'
          ? patch.content
          : patch.content && typeof patch.content === 'object' && 'text' in (patch.content as object)
            ? String((patch.content as { text?: string }).text || draft.contentText)
            : draft.contentText,
  };
  if (Array.isArray(patch.pages)) {
    next.pages = patch.pages as PhoneAppFormDraft['pages'];
  } else if (draft.pages) {
    next.pages = draft.pages;
  }
  return next;
}

/** 功能注释：去掉 assistant 可见 JSON 块，只留说明文案展示在聊天气泡。 */
export function stripPhoneAppJsonFence(text: string): string {
  return String(text || '')
    .replace(/```(?:json)?[\s\S]*?```/gi, '')
    .trim();
}
