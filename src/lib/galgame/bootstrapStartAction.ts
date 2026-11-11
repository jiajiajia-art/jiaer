/**
 * 功能注释：开局「开始游戏」固定 actionId，重复请求走幂等/回放，避免再打一路 LLM。
 */

export function buildBootstrapStartActionId(sessionId: string | null | undefined): string {
  const sid = String(sessionId || '').trim() || 'session';
  return `visual-${sid}-bootstrap-start`;
}

export function isBootstrapStartActionId(actionId: unknown): boolean {
  return String(actionId || '').trim().endsWith('-bootstrap-start');
}

export function isOpeningStartActionText(content: unknown): boolean {
  return String(content || '').trim() === '开始游戏';
}

/**
 * 功能注释：历史里若最后一条是「开始游戏」，是否还要自动重发 stream。
 * 新开局 / 正在开局时禁止再发；否则也必须带固定 bootstrap actionId（由调用方传入）。
 */
export function shouldSkipOpeningStartAutoResend(opts: {
  content: unknown;
  bootNewStart?: boolean;
  isStartingGame?: boolean;
  shouldAutoStartGame?: boolean;
}): boolean {
  if (!isOpeningStartActionText(opts.content)) return false;
  if (opts.bootNewStart) return true;
  if (opts.isStartingGame) return true;
  if (opts.shouldAutoStartGame) return true;
  return false;
}
