/**
 * ① 基础 · 基本信息字数契约：简介给玩家看，剧本基调是发给模型的系统提示词。
 * 与编辑器 UI / 保存闸门 / 单测共用，不依赖 React。
 */

/** 功能注释：列表与开局页简介，控制在短介绍篇幅 */
export const MOD_DESC_MAX = 200;

/** 功能注释：GM 开场 / 世界观 / 叙事口吻已并成一份系统提示词；上限与故事设定同为 5000 */
export const SCRIPT_TONE_MAX = 5000;
/** 功能注释：AI 生成剧本基调的目标字数区间；上限只是硬顶，不给目标时模型常只写几百字 */
export const SCRIPT_TONE_TARGET_MIN = 1500;
export const SCRIPT_TONE_TARGET_MAX = 3000;

export function modDescLen(description: string | null | undefined): number {
  return String(description ?? "").length;
}

export function isModDescOverLimit(description: string | null | undefined): boolean {
  return modDescLen(description) > MOD_DESC_MAX;
}

export function scriptToneLen(tone: string | null | undefined): number {
  return String(tone ?? "").length;
}

export function isScriptToneOverLimit(tone: string | null | undefined): boolean {
  return scriptToneLen(tone) > SCRIPT_TONE_MAX;
}

/**
 * 功能注释：保存前字数闸门；超限返回错误文案，未超限返回 null。
 */
export function validateModBasicInfoLimits(opts: {
  description?: string | null;
  scriptTone?: string | null;
}): string | null {
  if (isModDescOverLimit(opts.description)) return `简介最多 ${MOD_DESC_MAX} 字`;
  if (isScriptToneOverLimit(opts.scriptTone)) return `剧本基调最多 ${SCRIPT_TONE_MAX} 字`;
  return null;
}
