/**
 * 剥离私聊流式文本中的好感机器标，避免闪现在气泡里。
 */
const FAVOR_MARKER_RE = /\{\{\s*favor(?:ability|_delta)\s*:\s*[+-]?\d+\s*\}\}/gi;
/** 流式过程中尚未打完的尾标（含半截 {{favor…） */
const FAVOR_MARKER_INCOMPLETE_RE = /\n?\{\{\s*favor(?:ability|_delta)?[^}]*$/i;

export function stripPrivateChatFavorMarkers(text: string): string {
  let out = String(text || '').replace(FAVOR_MARKER_RE, '');
  out = out.replace(FAVOR_MARKER_INCOMPLETE_RE, '');
  // 功能注释：再挡一层半截花括号，避免 {{ 单独闪一下
  out = out.replace(/\n?\{\{[^}]*$/g, '');
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}
