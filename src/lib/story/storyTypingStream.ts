/**
 * 功能注释：流式文案增长时判断是否应续打而非清空重开。
 * raw_text 高频追加若每次重置打字机，会出现画布闪屏。
 */
export function isStreamingTextExtension(previous: string, next: string): boolean {
  const prev = String(previous ?? '');
  const cur = String(next ?? '');
  if (!prev || !cur) return false;
  if (cur === prev) return true;
  return cur.startsWith(prev);
}
