/**
 * 看板终态与重试按钮显隐（不依赖 job.status=completed）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isBatchNpcBoardSettled,
    isBatchSceneBoardAllSuccess,
    shouldShowRetryIncompleteBatchTasks,
    listBatchNpcRetryTargetItems,
    BATCH_STUCK_GENERATE_SECONDS,
} from '../src/utils/batchNpcBoardSettlement.ts';

test('全成功终态_settled但不显示重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'item_done' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 2), true);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 2), false);
});

test('有生图失败且其余完成_必须显示重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'item_done' },
        { stage: 'generate_fail' },
        { stage: 'item_done' },
        { stage: 'item_done' },
        { stage: 'item_done' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 6), true);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 6), true);
});

test('仍有抠图中_不算settled_但有失败可重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'rembg_start', stageElapsedSeconds: 10 },
        { stage: 'generate_fail' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 3), false);
    // CTA 可出；轮询是否停止由 isBatchNpcBoardSettled 单独决定
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 3), true);
});

test('分项数不足_不算settled_有失败仍可重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_fail' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 6), false);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 6), true);
});

test('含pending补位_不算settled_有失败仍可重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_fail' },
        { stage: 'pending' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 3), false);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 3), true);
});

test('rembg_done视为终态_可显示重试', () => {
    const items = [
        { stage: 'rembg_done' },
        { stage: 'generate_fail' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 2), true);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 2), true);
});

test('生图卡住超过阈值_其余已完成_必须显示重试', () => {
    const items = [
        { stage: 'item_done', id: 'a' },
        {
            stage: 'generate_start',
            id: 'b',
            stageElapsedSeconds: BATCH_STUCK_GENERATE_SECONDS,
        },
        { stage: 'item_done', id: 'c' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 3), false);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 3), true);
    const targets = listBatchNpcRetryTargetItems(items);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].id, 'b');
});

test('生图仅68s_未达卡住阈值_不显示重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_start', stageElapsedSeconds: 68 },
        { stage: 'item_done' },
    ];
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 3), false);
});

test('本地强制失败后_即使仍有排队也显示重试', () => {
    const items = [
        { stage: 'item_done', id: 'a' },
        { stage: 'generate_fail', id: 'b' },
        { stage: 'pending', id: 'c' },
    ];
    assert.equal(isBatchNpcBoardSettled(items, 3), false);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 3), true);
});

test('场景全成功_含generate_done_算allSuccess且不显示重试', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_done' },
        { stage: 'item_done' },
        { stage: 'item_done' },
        { stage: 'item_done' },
        { stage: 'item_done' },
    ];
    assert.equal(isBatchSceneBoardAllSuccess(items, 6), true);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 6), false);
});

test('场景6/6完成态_禁止仍按生成中文案', () => {
    const items = Array.from({ length: 6 }, () => ({ stage: 'item_done' }));
    assert.equal(isBatchSceneBoardAllSuccess(items, 6), true);
    // 完成态：不展示重试 CTA；UI 应走「已全部生成 / 同步结果」而非「请勿离开」
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 6), false);
});

test('场景有失败_不算allSuccess', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_fail' },
        { stage: 'item_done' },
    ];
    assert.equal(isBatchSceneBoardAllSuccess(items, 3), false);
    assert.equal(shouldShowRetryIncompleteBatchTasks(items, 3), true);
});
