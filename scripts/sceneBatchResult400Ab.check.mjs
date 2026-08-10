/**
 * 场景批量完成收尾 A/B（严格）
 *
 * 现象：分项 6/6 item_done 后 GET .../result 在 job 仍 running 时返回 400
 *       「Job not completed yet」——旧逻辑当成 AxiosError → toast「请检查网络连接」。
 *
 * A（错误）：result 400 → 整批失败 toast
 * B（正确）：result 400 → pending，继续轮询 / 用 savedResults 落地，禁止该 toast
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isBatchSceneBoardAllSuccess } from '../src/utils/batchNpcBoardSettlement.ts';

/** 与 handlers 同口径：是否应弹出「生成所有场景立绘失败，请检查网络连接」 */
function shouldToastNetworkFailOnResultError({
    boardItems,
    totalCount,
    resultHttpStatus,
    resultBodyStatus,
}) {
    const boardAllSuccess = isBatchSceneBoardAllSuccess(boardItems, totalCount);
    const resultNotReady = resultHttpStatus === 400
        || resultBodyStatus === 'running'
        || resultBodyStatus === 'pending';
    if (boardAllSuccess && resultNotReady) {
        return false; // B
    }
    if (boardAllSuccess) {
        return false; // 全成功其它收尾错误也不应误报网络
    }
    return true; // A 路径：真失败才 toast
}

test('A_旧逻辑对照_全成功且result400_不得toast网络失败', () => {
    const items = Array.from({ length: 6 }, () => ({ stage: 'item_done' }));
    assert.equal(isBatchSceneBoardAllSuccess(items, 6), true);
    assert.equal(
        shouldToastNetworkFailOnResultError({
            boardItems: items,
            totalCount: 6,
            resultHttpStatus: 400,
            resultBodyStatus: 'running',
        }),
        false,
        'B: 400 not completed yet 禁止 toast「请检查网络连接」',
    );
});

test('B_进行中真失败_仍可toast', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_start' },
    ];
    assert.equal(
        shouldToastNetworkFailOnResultError({
            boardItems: items,
            totalCount: 2,
            resultHttpStatus: 500,
            resultBodyStatus: undefined,
        }),
        true,
    );
});

test('B_全成功且result已就绪_不toast', () => {
    const items = Array.from({ length: 6 }, () => ({ stage: 'item_done' }));
    assert.equal(
        shouldToastNetworkFailOnResultError({
            boardItems: items,
            totalCount: 6,
            resultHttpStatus: 200,
            resultBodyStatus: 'completed',
        }),
        false,
    );
});
