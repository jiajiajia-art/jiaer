/**
 * 后台文案 LLM 配置：全站统一模型（与后端 TEXT_LLM_* 对齐）。
 */

export const TEXT_LLM_MODELS = [
  'doubao-seed-1-8-251228',
  'DeepSeek-V4-Pro-0813',
  'DeepSeek-V4-Flash 0731',
  'DeepSeek-V3.2 Speciale',
  'DeepSeek-V3.2',
  'deepseek-v3.1',
] as const;

export type TextLlmModel = (typeof TEXT_LLM_MODELS)[number];

export const DEFAULT_TEXT_LLM_MODEL: TextLlmModel = 'doubao-seed-1-8-251228';

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

export function isTextLlmModel(value: unknown): value is TextLlmModel {
  return TEXT_LLM_MODELS.includes(value as TextLlmModel);
}

export function normalizeTextLlmModel(value: unknown): TextLlmModel {
  return isTextLlmModel(value) ? value : DEFAULT_TEXT_LLM_MODEL;
}

/** 功能注释：卡片标题（运营可读）与网关侧真实 model id 分离展示。 */
export function getTextLlmModelLabel(model: TextLlmModel): string {
  if (model === 'doubao-seed-1-8-251228') return '豆包 Seed 1.8';
  if (model === 'DeepSeek-V4-Pro-0813') return 'DeepSeek V4 Pro';
  if (model === 'DeepSeek-V4-Flash 0731') return 'DeepSeek V4 Flash';
  if (model === 'DeepSeek-V3.2 Speciale') return 'DeepSeek V3.2 Speciale';
  if (model === 'DeepSeek-V3.2') return 'DeepSeek V3.2';
  if (model === 'deepseek-v3.1') return 'DeepSeek V3.1';
  return model;
}

export function getTextLlmModelVendor(model: TextLlmModel): string {
  if (model.startsWith('doubao')) return 'Doubao';
  return 'DeepSeek · epone';
}

export function getTextLlmModelMeta(model: TextLlmModel): string {
  if (model === DEFAULT_TEXT_LLM_MODEL) return '全站默认 · Ark';
  if (model.includes('V4-Pro')) return '1M ctx · 旗舰';
  if (model.includes('Flash')) return '1M ctx · 更快';
  if (model.includes('Speciale')) return '128K · 多模态';
  return '128K · epone 网关';
}

export function isDefaultTextLlmModel(model: TextLlmModel): boolean {
  return model === DEFAULT_TEXT_LLM_MODEL;
}
