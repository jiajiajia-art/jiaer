/** 简介编辑器回车：默认插入换行（br），而非新段落 */

export const RICH_EDITOR_LINE_BREAK_HTML = '<br>';

export function shouldInsertLineBreakOnKeyDown(event: {
  key?: string;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event?.isComposing) return false;
  if (event?.ctrlKey || event?.metaKey || event?.altKey) return false;
  return String(event?.key || '') === 'Enter';
}

/**
 * 在当前选区插入换行。优先 insertLineBreak，失败则 insertHTML('<br>')。
 * 返回是否执行了插入命令（不保证浏览器一定可见）。
 */
export function insertRichEditorLineBreak(
  execCommand: (commandId: string, showUI?: boolean, value?: string) => boolean = (commandId, showUI, value) =>
    document.execCommand(commandId, showUI, value),
): boolean {
  try {
    if (execCommand('insertLineBreak')) return true;
  } catch {
    // fall through
  }
  try {
    return !!execCommand('insertHTML', false, `${RICH_EDITOR_LINE_BREAK_HTML}\u200B`);
  } catch {
    return false;
  }
}
