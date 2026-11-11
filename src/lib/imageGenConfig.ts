/**
 * 后台生图配置：模块 key / 可选模型 / 独立网关（与文案 TEXT_LLM_* 互不影响）。
 */

export const IMAGE_GEN_MODELS = ['nano-banana-2', 'gpt-image-2'] as const;
export type ImageGenModel = (typeof IMAGE_GEN_MODELS)[number];

export const DEFAULT_IMAGE_GEN_MODEL: ImageGenModel = 'gpt-image-2';
export const DEFAULT_IMAGE_GEN_OPENAI_BASE_URL = 'https://epone.ggb.today';

export interface ImageGenGatewayPreset {
  id: string;
  label: string;
  baseUrl: string;
}

export const DEFAULT_IMAGE_GEN_GATEWAY_PRESETS: readonly ImageGenGatewayPreset[] = [
  { id: 'epone', label: 'epone / ggb', baseUrl: 'https://epone.ggb.today' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api' },
];

/** 功能注释：剥误填路径，只保留基础 URL。 */
export function normalizeImageGenOpenAiBaseUrl(value: unknown): string {
  let raw = String(value || '').trim();
  if (!raw) return '';
  raw = raw.replace(/\/+$/, '');
  raw = raw.replace(/\/v1\/images\/generations$/i, '');
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
export type ImageGenModuleKey =
  | 'visual'
  | 'session_avatar'
  | 'warehouse_card'
  | 'world_scene'
  | 'legacy';

export interface ImageGenModuleMeta {
  key: ImageGenModuleKey;
  label: string;
  description: string;
}

/** 功能注释：与运营台「生图配置」五行模块一致 */
export const IMAGE_GEN_MODULE_CATALOG: readonly ImageGenModuleMeta[] = [
  {
    key: 'visual',
    label: '视觉小说立绘 / 场景 / 编剧资产',
    description: '视觉小说立绘、场景背景与编剧台资产生图',
  },
  {
    key: 'session_avatar',
    label: '局内头像',
    description: '局内添加角色时的 AI 头像生成',
  },
  {
    key: 'warehouse_card',
    label: '仓库人设/角色卡',
    description: '仓库人设卡与角色卡头像生成',
  },
  {
    key: 'world_scene',
    label: '世界互动场景/子场景',
    description: '世界互动插件场景与子场景生图',
  },
  {
    key: 'legacy',
    label: 'legacy 生图服务',
    description: '旧版 Node legacy 生图入口',
  },
];

export function isImageGenModel(value: unknown): value is ImageGenModel {
  return IMAGE_GEN_MODELS.includes(value as ImageGenModel);
}

/**
 * 功能注释：非法模型回落默认，保证下拉框始终有合法选中项。
 */
export function normalizeImageGenModel(value: unknown): ImageGenModel {
  return isImageGenModel(value) ? value : DEFAULT_IMAGE_GEN_MODEL;
}

/**
 * 功能注释：把服务端 modules 列表合并成可提交的 { key: model }。
 */
export function toImageGenModelsPayload(
  modules: Array<{ key: string; model: string }>,
): Record<string, ImageGenModel> {
  const out: Record<string, ImageGenModel> = {};
  for (const row of modules) {
    const key = String(row.key || '').trim();
    if (!key) continue;
    out[key] = normalizeImageGenModel(row.model);
  }
  return out;
}
