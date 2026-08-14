import {
  descriptionToPlainText,
  normalizeDescriptionForSave,
  normalizeDescriptionHtmlForSave,
} from './gameDescriptionHtml.ts';

/** 源码模式：把用户编辑的 HTML 消毒并归一化为可落库内容 */
export function applyRichEditorSourceHtml(
  rawSource: string,
  hostAddress = '',
): { html: string; plainLength: number } {
  const html = normalizeDescriptionForSave(String(rawSource || ''), hostAddress);
  return {
    html,
    plainLength: Array.from(descriptionToPlainText(html)).length,
  };
}

export function openRichEditorSourceDraft(
  currentVisualHtml: string,
  hostAddress = '',
): string {
  return normalizeDescriptionHtmlForSave(String(currentVisualHtml || ''), hostAddress);
}
