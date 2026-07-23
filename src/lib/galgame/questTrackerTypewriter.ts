/**
 * 顶栏任务追踪打字机：新任务文案变化时重开动画。
 */

/** 全文变化则重开打字机；空文案不播。 */
export function shouldRestartQuestTrackerTypewriter(prevFull: string, nextFull: string): boolean {
  const next = String(nextFull || '');
  if (!next) return false;
  return next !== String(prevFull || '');
}

/** 按可见字数切片（按 UTF-16 code unit，与 String.length 一致）。 */
export function sliceQuestTrackerTypewriterText(full: string, visibleCount: number): string {
  const text = String(full || '');
  if (!text) return '';
  const safe = Math.max(0, Math.min(text.length, Math.floor(Number(visibleCount) || 0)));
  return text.slice(0, safe);
}

/** 推进一格；到顶后保持满长。 */
export function nextQuestTrackerTypewriterCount(current: number, total: number): number {
  const cur = Math.max(0, Math.floor(Number(current) || 0));
  const len = Math.max(0, Math.floor(Number(total) || 0));
  if (cur >= len) return len;
  return cur + 1;
}
