/**
 * 选项步是否应暂缓展示，直到本轮流式生成结束。
 * 对话步可边生成边播；choice 过早上屏会导致锁冲突「正在生成中」。
 */
export function shouldDeferChoiceUntilStreamReady(input: {
  stepType?: string | null;
  streamLoading: boolean;
}): boolean {
  return input.stepType === 'choice' && input.streamLoading;
}

/**
 * 功能注释（Aliyun 兼容）：流未结束 defer choice 时是否清空 currentStep。
 * CF 保持历史行为 true；Aliyun 为 false，保留已展示旁白，仍由用户点「下一页」播完队列。
 */
export function shouldClearCurrentStepWhenDeferringChoice(aliyunRuntime: boolean): boolean {
  return !aliyunRuntime;
}

/**
 * 功能注释（Aliyun 兼容）：旁白已展示且流结束后自动衔上队首 choice。
 */
export function shouldAutoPromoteReadyChoice(input: {
  aliyunRuntime: boolean;
  currentStepType?: string | null;
  nextStepType?: string | null;
  streamLoading: boolean;
  hasCurrentStep: boolean;
  isWaitingForData: boolean;
}): boolean {
  if (!input.aliyunRuntime) return false;
  if (!input.hasCurrentStep || input.isWaitingForData || input.streamLoading) return false;
  if (input.nextStepType !== 'choice') return false;
  if (input.currentStepType === 'choice') return false;
  return true;
}

/** 识别会话锁未释放 / 仍在生成的错误文案（含前后端映射后的中文）。 */
export function isGenerationBusyError(message: unknown): boolean {
  const text = String(message || '');
  if (!text) return false;
  return (
    text.includes('正在生成中')
    || text.includes('Failed to acquire lock')
    || text.includes('Lock acquisition timeout')
    || text.includes('visual:locks:')
    || text.includes('Action is already processing')
    || text.includes('Session is busy')
    || text === 'LOCKED'
  );
}

/** 锁冲突静默重试次数（不含首次请求）。 */
export const GENERATION_BUSY_MAX_RETRIES = 4;

/** 第 n 次重试前的等待（ms）；属性/任务落盘争用通常几百毫秒级。 */
export function getGenerationBusyRetryDelayMs(attemptIndex: number): number {
  const n = Math.max(0, Number(attemptIndex) || 0);
  return Math.min(700 * (n + 1), 2800);
}
