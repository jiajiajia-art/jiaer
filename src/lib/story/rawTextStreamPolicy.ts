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
 * 功能注释：raw 旁白是否跳过打字机。
 * 本地与生产统一保留打字机（完句上屏后逐字出现）；参数保留便于调用方统一传参。
 */
export function shouldSkipTypewriterForRawTextBridge(_options: {
  aliyunRuntime: boolean;
  isDev?: boolean;
  fromRawText: boolean;
}): boolean {
  return false;
}
