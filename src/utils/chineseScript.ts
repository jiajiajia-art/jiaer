import * as OpenCC from 'opencc-js';

/** 功能注释：单例简→繁转换，i18n 文案与接口中文展示共用 */
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });

/**
 * 功能注释：识别繁体语言码。不引用 appLanguage，避免 Node ESM 测 chineseScript 时缺 .ts 后缀。
 */
function isTraditionalLanguage(raw?: string | null): boolean {
  const lower = String(raw || '').trim().replace(/_/g, '-').toLowerCase();
  return (
    lower === 'zh-tw'
    || lower === 'zh-hk'
    || lower === 'zh-mo'
    || lower === 'zh-hant'
    || lower.startsWith('zh-hant')
  );
}

export function convertSimplifiedToTraditional(text: string): string {
  if (!text) return text;
  return toTraditional(text);
}

/**
 * 功能注释：接口下发的中文（题材标签等）不在 i18n JSON 里；
 * 切到繁体时运行时转写，英文/简体保持原文。
 */
export function localizeChineseByLanguage(
  text: string,
  language?: string | null,
): string {
  if (!text || !isTraditionalLanguage(language)) return text;
  return convertSimplifiedToTraditional(text);
}
