/** 批量生图任务轮询上限（约 15 分钟，间隔 1.5s） */
export const BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS = 600;

export type BatchImageJobPollStep =
    | 'continue'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'timeout'
    | 'board_settled_retry';

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
