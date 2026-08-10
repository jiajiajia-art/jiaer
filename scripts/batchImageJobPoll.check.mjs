/**
 * 批量生图轮询取消逻辑单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS,
    resolveBatchImageJobPollStep,
} from '../src/utils/batchImageJobPoll.ts';

test('resolveBatchImageJobPollStep returns cancelled when user aborts', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: true,
            status: 'running',
            attempt: 0,
        }),
        'cancelled',
    );
});

test('resolveBatchImageJobPollStep returns timeout at max attempts', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'running',
            attempt: BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS,
        }),
        'timeout',
    );
});

test('resolveBatchImageJobPollStep returns completed for finished job', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'completed',
            attempt: 3,
        }),
        'completed',
    );
});

test('resolveBatchImageJobPollStep returns failed for failed or unknown status', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'failed',
            attempt: 1,
        }),
        'failed',
    );
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'unknown',
            attempt: 1,
        }),
        'failed',
    );
});

test('resolveBatchImageJobPollStep returns continue while job is still running', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'running',
            attempt: 2,
        }),
        'continue',
    );
});

test('resolveBatchImageJobPollStep returns board_settled_retry when items finished with failures', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'running',
            attempt: 4,
            boardSettledWithFailures: true,
        }),
        'board_settled_retry',
    );
});

test('completed status wins over boardSettledWithFailures', () => {
    assert.equal(
        resolveBatchImageJobPollStep({
            cancelRequested: false,
            status: 'completed',
            attempt: 4,
            boardSettledWithFailures: true,
        }),
        'completed',
    );
});
