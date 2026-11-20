/**
 * 功能注释：流式正文写完、状态块缺失时，前端会请 AI 只补状态块（约 20–30 秒）。
 * 该标记追加在 live 文本末尾，仅供 LiveNarration 识别：剥掉后在正文外显示状态提示，
 * 不把它当成剧情旁白渲染（B-03）。
 */
export const STATE_REPAIR_MARK = "\u2063（状态没写完整，正在补全……）";
const STATE_REPAIR_SUFFIX = /\s*\u2063?（状态没写完整，正在补全……）\s*$/;

export function splitStateRepair(live: string): { text: string; repairing: boolean } {
  const suffix = STATE_REPAIR_SUFFIX.exec(live);
  return suffix ? { text: live.slice(0, suffix.index), repairing: true } : { text: live, repairing: false };
}
