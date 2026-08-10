/**
 * 私聊静默主动开口：判断是否应启动 30s 计时。
 * 主角不回时，尾部连续助手气泡达到 maxIdleReplies（默认 2）则不再计时。
 */

export const PRIVATE_CHAT_IDLE_NUDGE_MAX_DEFAULT = 2;

export type PrivateChatIdleAb = {
  idleProactive?: boolean;
  idleProactiveMs?: number;
} | null | undefined;

export function resolvePrivateChatIdleMs(ab: PrivateChatIdleAb, fallback = 30_000): number {
  const n = Number(ab?.idleProactiveMs);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(5_000, Math.min(120_000, Math.round(n)));
}

/** 功能注释：末尾连续 assistant 条数（中间无 user）。 */
export function countTrailingAssistantMessages(
  messages: Array<{ role?: string }> | null | undefined,
): number {
  const list = Array.isArray(messages) ? messages : [];
  let n = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (String(list[i]?.role || '') === 'assistant') n += 1;
    else break;
  }
  return n;
}

export function shouldArmPrivateChatIdleNudge(input: {
  ab: PrivateChatIdleAb;
  busy: boolean;
  waitingNarrative: boolean;
  loading: boolean;
  draft: string;
  messages: Array<{ role?: string }>;
  maxIdleReplies?: number;
}): boolean {
  if (!input.ab?.idleProactive) return false;
  if (input.busy || input.waitingNarrative || input.loading) return false;
  if (String(input.draft || '').trim()) return false;
  const list = Array.isArray(input.messages) ? input.messages : [];
  if (list.length === 0) return false;
  const last = list[list.length - 1];
  if (String(last?.role || '') !== 'assistant') return false;
  const maxN = Math.max(
    1,
    Math.min(10, Number(input.maxIdleReplies) || PRIVATE_CHAT_IDLE_NUDGE_MAX_DEFAULT),
  );
  // 已聊满 N 次（含招呼/上轮回复），主角不回就不再主动开口
  if (countTrailingAssistantMessages(list) >= maxN) return false;
  return true;
}
