/**
 * 组装封面生图创意提示：仅用户输入；空则不塞默认字体/标题当提示词。
 */

/**
 * 功能注释：有输入才返回；空字符串表示「无额外要求」，垫图时沿用参考图标题字效。
 */
export function buildCoverAiCreativePrompt(options: {
  promptDraft?: string | null;
}): string {
  return String(options.promptDraft || '').trim();
}
