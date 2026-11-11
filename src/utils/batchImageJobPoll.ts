/** 批量生图任务轮询上限（约 15 分钟，间隔 1.5s） */
export const BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS = 600;

export type BatchImageJobPollStep =
    | 'continue'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'timeout'
    | 'board_settled_retry';

export interface BatchImageJobProgressCounts {
  /** 真正成功落盘张数（禁止把失败项算进 completed） */
  successCount: number;
  failedCount: number;
  /** 任务总张数 */
  totalCount: number;
  /** 已终态张数（成功+失败），仅用于判断是否跑完 */
  settledCount: number;
}

/**
 * 功能注释：从批量 job status 提取成功/失败张数；completedCount 含失败，不能直接当进度分子。
 */
export function resolveBatchImageJobProgressCounts(data: {
  completedCount?: number;
  totalCount?: number;
  failedCount?: number;
  savedResults?: unknown;
  items?: Array<{ stage?: string } | null | undefined> | null;
  result?: {
    results?: { effectiveSuccessful?: number; totalErrors?: number } | null;
    scenes?: { effective?: number } | null;
    npcs?: { effective?: number } | null;
    player?: { effective?: number } | null;
  } | null;
} | null | undefined): BatchImageJobProgressCounts {
  const totalCount = Math.max(0, Number(data?.totalCount) || 0);
  const failedFromField = Math.max(0, Number(data?.failedCount) || 0);
  const settledFromField = Math.max(0, Number(data?.completedCount) || 0);

  const items = Array.isArray(data?.items) ? data.items : [];
  const itemDone = items.filter((row) => String(row?.stage || '') === 'item_done').length;
  const itemFail = items.filter((row) => {
    const stage = String(row?.stage || '');
    return stage.includes('fail');
  }).length;

  const savedLen = Array.isArray(data?.savedResults) ? data.savedResults.length : 0;
  const effectiveFromResult = Math.max(
    0,
    Number(data?.result?.results?.effectiveSuccessful)
      || Number(data?.result?.scenes?.effective)
      || (
        (Number(data?.result?.npcs?.effective) || 0)
        + (Number(data?.result?.player?.effective) || 0)
      )
      || 0,
  );

  // 优先：savedResults / item_done / result.effective；勿用 completedCount 当成功数
  let successCount = Math.max(savedLen, itemDone, effectiveFromResult);
  let failedCount = Math.max(failedFromField, itemFail);

  if (successCount <= 0 && settledFromField > 0) {
    successCount = Math.max(0, settledFromField - failedCount);
  }
  if (failedCount <= 0 && settledFromField > successCount) {
    failedCount = settledFromField - successCount;
  }

  const settledCount = Math.max(settledFromField, successCount + failedCount, itemDone + itemFail);
  return {
    successCount: totalCount > 0 ? Math.min(successCount, totalCount) : successCount,
    failedCount,
    totalCount,
    settledCount,
  };
}

/**
 * 根据取消标记、任务状态与轮询次数决定下一步动作，供前端批量生图轮询复用。
 */
export function resolveBatchImageJobPollStep(input: {
    cancelRequested: boolean;
    status: string;
    attempt: number;
    maxAttempts?: number;
    /** 分项已全部终态且存在失败：可提前结束轮询，展示重试 */
    boardSettledWithFailures?: boolean;
}): BatchImageJobPollStep {
    const maxAttempts = input.maxAttempts ?? BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS;

    if (input.cancelRequested) {
        return 'cancelled';
    }
    if (input.attempt >= maxAttempts) {
        return 'timeout';
    }
    if (input.status === 'completed') {
        return 'completed';
    }
    if (input.status === 'failed' || input.status === 'unknown') {
        return 'failed';
    }
    // job 仍 running，但分项已全终态且有失败 → 不必空等积分 result
    if (input.boardSettledWithFailures) {
        return 'board_settled_retry';
    }
    return 'continue';
}
