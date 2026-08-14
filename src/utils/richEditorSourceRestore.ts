/** 判断可视化编辑器 DOM 是否为空（源码切换卸载后常见） */
export function isRichEditorVisualEmpty(innerHTML: string): boolean {
  const raw = String(innerHTML || '').trim();
  if (!raw) return true;
  const normalized = raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<div>\s*<\/div>/gi, '')
    .replace(/\u200B/g, '')
    .trim();
  return !normalized || normalized === '<p></p>';
}

/** 退出源码模式时是否应强制回写可视化内容 */
export function shouldForceRestoreVisualAfterSourceExit(options: {
  sourceMode: boolean;
  valueHtml: string;
  lastEmittedHtml: string;
  visualInnerHTML: string;
}): boolean {
  if (options.sourceMode) return false;
  if (isRichEditorVisualEmpty(options.visualInnerHTML) && String(options.valueHtml || '').trim()) {
    return true;
  }
  return String(options.valueHtml || '') !== String(options.lastEmittedHtml || '');
}
