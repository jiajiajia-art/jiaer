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
  // 功能注释：国内默认生文网关；运营台 Tab 标「GGB」方便一键切回
  { id: 'epone', label: 'GGB（默认）', baseUrl: 'https://epone.ggb.today' },
  // 功能注释：TokenHub 文档 baseURL 为 …/v1；此处存根地址，保存时会剥掉 /v1
  { id: 'tokenhub', label: 'TokenHub', baseUrl: 'https://tokenhub.tencentmaas.com' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api' },
];

/** 功能注释：运营台始终置顶展示的默认 GGB 网关 id */
export const DEFAULT_TEXT_LLM_GGB_GATEWAY_ID = 'epone';

export type TextLlmGatewayTab = {
  id: string;
  label: string;
  baseUrl: string;
  isCustom?: boolean;
};

/**
 * 功能注释：运营台生文网关 Tab——始终置顶 GGB；再并入已存密钥的预置、当前地址、用户自定义槽。
 * ≥2 个时 UI 用 Tab；仅 GGB 时不必切 Tab。
 */
export function buildTextLlmGatewayTabs(options: {
  presets?: readonly TextLlmGatewayPreset[];
  activeBaseUrl?: string;
  gatewayKeyStates?: Record<string, { keySet?: boolean } | undefined>;
  customTabs?: readonly TextLlmGatewayTab[];
}): TextLlmGatewayTab[] {
  const presets = options.presets?.length ? options.presets : DEFAULT_TEXT_LLM_GATEWAY_PRESETS;
  const ggb = presets.find((p) => p.id === DEFAULT_TEXT_LLM_GGB_GATEWAY_ID)
    || { id: DEFAULT_TEXT_LLM_GGB_GATEWAY_ID, label: 'GGB（默认）', baseUrl: 'https://epone.ggb.today' };
  const list: TextLlmGatewayTab[] = [{ id: ggb.id, label: ggb.label, baseUrl: ggb.baseUrl }];
  const seen = new Set([normalizeTextLlmOpenAiBaseUrl(ggb.baseUrl)]);

  const push = (tab: TextLlmGatewayTab) => {
    const key = normalizeTextLlmOpenAiBaseUrl(tab.baseUrl);
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(tab);
  };

  for (const preset of presets) {
    if (preset.id === ggb.id) continue;
    if (options.gatewayKeyStates?.[preset.id]?.keySet) {
      push({ id: preset.id, label: preset.label, baseUrl: preset.baseUrl });
    }
  }

  for (const custom of options.customTabs || []) {
    push({ ...custom, isCustom: true });
  }

  const active = normalizeTextLlmOpenAiBaseUrl(options.activeBaseUrl || '');
  if (active && !seen.has(active)) {
    const presetId = resolveTextLlmGatewayPresetId(active);
    const preset = presetId ? presets.find((p) => p.id === presetId) : null;
    push(preset
      ? { id: preset.id, label: preset.label, baseUrl: preset.baseUrl }
      : { id: `custom-${active}`, label: '自定义网关', baseUrl: active, isCustom: true });
  }

  return list;
}

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
  {
    key: 'romance_world_gen',
    label: 'Romance 生成世界（模组补全）',
    description: 'world-gen/complete · 与后台文案模型同一套，不强制豆包',
  },
  {
    key: 'romance_play',
    label: 'Romance 局内叙事 / Studio 预览',
    description: 'play/complete · 有平台登录时局内回合走同一套文案配置',
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

/** 功能注释：按标准化 baseUrl 反查快捷网关 id，供切换时读写对应密钥。 */
export function resolveTextLlmGatewayPresetId(
  baseUrl: unknown,
  presets: readonly TextLlmGatewayPreset[] = DEFAULT_TEXT_LLM_GATEWAY_PRESETS,
): string {
  const normalized = normalizeTextLlmOpenAiBaseUrl(baseUrl);
  if (!normalized) return '';
  const hit = presets.find((p) => p.baseUrl === normalized);
  return hit ? String(hit.id) : '';
}

/**
 * 功能注释：点预置模型卡片时，应切到哪条网关以便回显密钥 / 拉取模型。
 * DeepSeek 预置 id 走 epone（ggb）；豆包走 Ark，不强制改 OpenAI 网关。
 */
export function resolvePreferredTextLlmGatewayPresetId(model: unknown): string {
  const id = String(model || '').trim();
  if (!id) return '';
  if (id.startsWith('doubao')) return '';
  if (/^deepseek/i.test(id)) return 'epone';
  return '';
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
  if (/^deepseek/i.test(String(model))) return 'DeepSeek · epone / ggb';
  return 'OpenAI 兼容';
}

export function getTextLlmModelMeta(model: TextLlmModel): string {
  if (model === DEFAULT_TEXT_LLM_MODEL) return '全站默认 · Ark';
  if (model === 'deepseek-v4.1-flash') return '1M ctx · 点选切 epone 密钥';
  if (String(model).includes('v4-pro')) return '1M ctx · 点选切 epone 密钥';
  if (String(model).includes('flash')) return '1M ctx · 点选切 epone 密钥';
  if (String(model).includes('speciale')) return '128K · 点选切 epone 密钥';
  if (isTextLlmPresetModel(model) && /^deepseek/i.test(String(model))) {
    return '128K · 点选切 epone 密钥';
  }
  if (isTextLlmPresetModel(model)) return '128K · 网关';
  return '自定义 · 网关拉取';
}

export function isDefaultTextLlmModel(model: TextLlmModel): boolean {
  return model === DEFAULT_TEXT_LLM_MODEL;
}
