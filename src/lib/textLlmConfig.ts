/**
 * 后台文案 LLM 配置：全站统一模型 + 可选 OpenAI 兼容网关（与后端 TEXT_LLM_* 对齐）。
 * DeepSeek 预置用 epone API id；也可填官方网关拉取到的自定义 id。
 */

export const TEXT_LLM_MODELS = [
  'doubao-seed-2-1-lite-260915',
  'deepseek-v4.1-flash',
  'deepseek-v4-pro-0813',
  'deepseek-v4-flash-0731',
  'deepseek-v3.2-speciale',
  'deepseek-v3.2',
  'deepseek-v3.1',
] as const;

export type TextLlmPresetModel = (typeof TEXT_LLM_MODELS)[number];
/** 功能注释：含运营自定义网关模型 id */
export type TextLlmModel = TextLlmPresetModel | string;

export interface TextLlmGatewayPreset {
  id: string;
  label: string;
  baseUrl: string;
}

/** 旧展示名 / 历史 DB 值 → epone API id */
const TEXT_LLM_MODEL_ALIASES: Record<string, string> = {
  'DeepSeek-V4-Pro-0813': 'deepseek-v4-pro-0813',
  'DeepSeek-V4-Flash 0731': 'deepseek-v4-flash-0731',
  'DeepSeek V4.1 Flash': 'deepseek-v4.1-flash',
  'DeepSeek-V4.1-Flash': 'deepseek-v4.1-flash',
  'DeepSeek-V3.2 Speciale': 'deepseek-v3.2-speciale',
  'DeepSeek-V3.2': 'deepseek-v3.2',
  'doubao-seed-1-8-251228': 'doubao-seed-2-1-lite-260915',
};

export const DEFAULT_TEXT_LLM_MODEL: TextLlmPresetModel = 'doubao-seed-2-1-lite-260915';

export const DEFAULT_TEXT_LLM_GATEWAY_PRESETS: readonly TextLlmGatewayPreset[] = [
  { id: 'deepseek', label: 'DeepSeek 官方', baseUrl: 'https://api.deepseek.com' },
  { id: 'epone', label: 'epone 代理', baseUrl: 'https://epone.ggb.today' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api' },
];

export interface TextLlmUsageRow {
  key: string;
  label: string;
  description: string;
}

/** 功能注释：运营台只读展示「配置一处、全站生效」覆盖范围 */
export const TEXT_LLM_USAGE_CATALOG: readonly TextLlmUsageRow[] = [
  {
    key: 'visual_action',
    label: '局内叙事 / 选项 / 重生成',
    description: '游玩主链路 sendActionStream / regenerate',
  },
  {
    key: 'visual_side_text',
    label: '私聊、属性面板、任务等文案',
    description: 'privateChat、getQuests、getAttributePanels',
  },
  {
    key: 'visual_doc',
    label: '文档解析 / 一句话生成 / 创意文案',
    description: 'visualDocConsumer、ideaTextGenerate',
  },
  {
    key: 'context_memory',
    label: '上下文记忆压缩',
    description: 'contextMemory 摘要与压缩',
  },
  {
    key: 'story_generation',
    label: '故事结构生成',
    description: 'storyGenerationConsumer / storyGeneration',
  },
];

export function isTextLlmPresetModel(value: unknown): value is TextLlmPresetModel {
  return TEXT_LLM_MODELS.includes(value as TextLlmPresetModel);
}

export function isSafeCustomTextLlmModelId(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (raw.length < 2 || raw.length > 128) return false;
  if (/\s/.test(raw)) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(raw);
}

export function isTextLlmModel(value: unknown): value is TextLlmModel {
  return isTextLlmPresetModel(value) || isSafeCustomTextLlmModelId(value);
}

/**
 * 功能注释：读后台/接口返回时，把旧展示名纠正为 API id；非法回落默认豆包。
 */
export function normalizeTextLlmModel(value: unknown): TextLlmModel {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_TEXT_LLM_MODEL;
  const aliased: string = TEXT_LLM_MODEL_ALIASES[raw] || raw;
  if (isTextLlmPresetModel(aliased)) return aliased;
  if (/^deepseek/i.test(aliased)) {
    const lower = aliased.toLowerCase().replace(/\s+/g, '-');
    if (isTextLlmPresetModel(lower)) return lower;
  }
  if (isSafeCustomTextLlmModelId(aliased)) return aliased;
  return DEFAULT_TEXT_LLM_MODEL;
}

/** 功能注释：剥掉误填的 /v1/chat/completions，只保留基础 URL。 */
export function normalizeTextLlmOpenAiBaseUrl(value: unknown): string {
  let raw = String(value || '').trim();
  if (!raw) return '';
  raw = raw.replace(/\/+$/, '');
  raw = raw.replace(/\/v1\/chat\/completions$/i, '');
  raw = raw.replace(/\/chat\/completions$/i, '');
  raw = raw.replace(/\/v1$/i, '');
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** 功能注释：卡片标题（运营可读）与网关侧真实 model id 分离展示。 */
export function getTextLlmModelLabel(model: TextLlmModel): string {
  if (model === 'doubao-seed-2-1-lite-260915') return '豆包 Seed 2.1 Lite';
  if (model === 'deepseek-v4.1-flash') return 'DeepSeek V4.1 Flash';
  if (model === 'deepseek-v4-pro-0813') return 'DeepSeek V4 Pro';
  if (model === 'deepseek-v4-flash-0731') return 'DeepSeek V4 Flash 0731';
  if (model === 'deepseek-v3.2-speciale') return 'DeepSeek V3.2 Speciale';
  if (model === 'deepseek-v3.2') return 'DeepSeek V3.2';
  if (model === 'deepseek-v3.1') return 'DeepSeek V3.1';
  return model;
}

export function getTextLlmModelVendor(model: TextLlmModel): string {
  if (String(model).startsWith('doubao')) return 'Doubao';
  if (/^deepseek/i.test(String(model))) return 'DeepSeek · OpenAI 兼容';
  return 'OpenAI 兼容';
}

export function getTextLlmModelMeta(model: TextLlmModel): string {
  if (model === DEFAULT_TEXT_LLM_MODEL) return '全站默认 · Ark';
  if (model === 'deepseek-v4.1-flash') return '1M ctx · V4.1 更快';
  if (String(model).includes('v4-pro')) return '1M ctx · 旗舰';
  if (String(model).includes('flash')) return '1M ctx · 更快';
  if (String(model).includes('speciale')) return '128K · Speciale';
  if (isTextLlmPresetModel(model)) return '128K · 网关';
  return '自定义 · 网关拉取';
}

export function isDefaultTextLlmModel(model: TextLlmModel): boolean {
  return model === DEFAULT_TEXT_LLM_MODEL;
}
