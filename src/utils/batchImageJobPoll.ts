/** 批量生图任务轮询上限（约 15 分钟，间隔 1.5s） */
export const BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS = 600;

export type BatchImageJobPollStep =
    | 'continue'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'timeout';

/**
 * 根据取消标记、任务状态与轮询次数决定下一步动作，供前端批量生图轮询复用。
 */
export function resolveBatchImageJobPollStep(input: {
    cancelRequested: boolean;
    status: string;
    attempt: number;
    maxAttempts?: number;
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
    return 'continue';
}
