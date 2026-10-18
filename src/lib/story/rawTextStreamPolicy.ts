/**
 * 功能注释：raw_text 按句上屏策略。
 * - 线上 CF 构建不启用；Aliyun / 本地 Vite 联调启用
 * - 启用时须忽略流式增量 formal step，否则 handoff 会清掉已入队旁白
 */

/** bridge 开启时：跳过 type=step，等 data/complete 再接手正式步骤 */
export function shouldDeferFormalStepForRawTextBridge(
  enableRawTextStepBridge: boolean,
): boolean {
  return Boolean(enableRawTextStepBridge);
}

/**
 * 功能注释：是否启用 raw 按句上屏（满 3 句点下一步）。
 * 本地 Vite（import.meta.env.DEV）一律开，便于联调；生产仅 Aliyun。
 */
export function shouldEnableRawTextStepBridge(options: {
  aliyunRuntime: boolean;
  isDev?: boolean;
}): boolean {
  if (options.aliyunRuntime) return true;
  if (options.isDev) return true;
  return false;
}

/**
 * 功能注释：raw 旁白跳过打字机——有 SSE 可见字即整段上屏，不等逐字、也不等句号。
 * 正式 step（非 _fromRawText）仍走打字机。
 */
export function shouldSkipTypewriterForRawTextBridge(options: {
  aliyunRuntime: boolean;
  isDev?: boolean;
  fromRawText: boolean;
}): boolean {
  return Boolean(options?.fromRawText);
}

/**
 * 功能注释：generation_retry 时若画布已有旁白，禁止整屏清空。
 * 否则用户看到「字出完 → 未点下一步 → 突然重载」。
 */
export function shouldPreserveCanvasOnGenerationRetry(currentStep: {
  _fromRawText?: boolean;
  content?: unknown;
  text?: unknown;
} | null | undefined): boolean {
  if (!currentStep) return false;
  if (currentStep._fromRawText) return true;
  const content = String(currentStep.content || currentStep.text || '').trim();
  return content.length > 0;
}
