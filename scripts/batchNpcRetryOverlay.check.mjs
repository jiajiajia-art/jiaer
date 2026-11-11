/**
 * A/B：抠图失败后「重新生成未完成」必须能弹出积分确认（遮罩让路 + z-index）。
 * A = rembg_fail 终态看板 → 展示重试 CTA，遮罩可见
 * B = 同上但积分确认已打开 → 遮罩必须隐藏（否则 ConfirmModal 被压住像「没反应」）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    listBatchNpcRetryTargetItems,
    resolveRetryCharacterIdsFromBoard,
    shouldShowBatchProgressOverlay,
    shouldShowRetryIncompleteBatchTasks,
} from '../src/utils/batchNpcBoardSettlement.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const rembgFailBoard = [
    { id: 'c3', name: '张老校尉', stage: 'item_done', index: 3 },
    { id: 'c4', name: '匈奴夜枭王子', stage: 'rembg_fail', index: 4 },
    { id: 'c5', name: '军医吏李砚', stage: 'item_done', index: 5 },
    { id: 'c6', name: '御史大夫王绾', stage: 'rembg_done', index: 6 },
    { id: 'c1', name: '角色1', stage: 'item_done', index: 1 },
    { id: 'c2', name: '角色2', stage: 'item_done', index: 2 },
];

test('A: rembg_fail settled board shows retry CTA and targets only failed ids', () => {
    assert.equal(shouldShowRetryIncompleteBatchTasks(rembgFailBoard, 6), true);
    const targets = listBatchNpcRetryTargetItems(rembgFailBoard);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].name, '匈奴夜枭王子');
    assert.deepEqual(
        resolveRetryCharacterIdsFromBoard(rembgFailBoard),
        ['c4'],
    );
    // 功能注释：已完成 id 不得进入重试列表
    assert.equal(resolveRetryCharacterIdsFromBoard(rembgFailBoard).includes('c3'), false);
    assert.equal(resolveRetryCharacterIdsFromBoard(rembgFailBoard).includes('c6'), false);
    assert.equal(
        shouldShowBatchProgressOverlay({
            batchJobActive: true,
            costModalOpen: false,
            resultModalOpen: false,
        }),
        true,
        'A: overlay stays while waiting for retry click',
    );
});

test('B: cost/result modal open must hide batch overlay (fix click-no-op under mask)', () => {
    assert.equal(
        shouldShowBatchProgressOverlay({
            batchJobActive: true,
            costModalOpen: true,
            resultModalOpen: false,
        }),
        false,
        'B: hide overlay when cost ConfirmModal opens',
    );
    assert.equal(
        shouldShowBatchProgressOverlay({
            batchJobActive: true,
            costModalOpen: false,
            resultModalOpen: true,
        }),
        false,
        'B: hide overlay when result modal opens',
    );
    assert.equal(
        shouldShowBatchProgressOverlay({
            batchJobActive: false,
            costModalOpen: false,
            resultModalOpen: false,
        }),
        false,
    );
});

test('A/B resolveRetry: name fallback when board item missing id', () => {
    const board = [{ name: '匈奴夜枭王子', stage: 'rembg_fail', index: 4 }];
    assert.deepEqual(
        resolveRetryCharacterIdsFromBoard(board, (name) => (name === '匈奴夜枭王子' ? 'npc-4' : undefined)),
        ['npc-4'],
    );
});

test('ConfirmModal / GenerateResultModal z-index above batch overlay 9999', () => {
    const confirmCss = readFileSync(
        join(root, 'src/components/CommonModal/ConfirmModal.module.css'),
        'utf8',
    );
    const resultCss = readFileSync(
        join(root, 'src/components/CommonModal/GenerateResultModal.module.css'),
        'utf8',
    );
    assert.match(confirmCss, /z-index:\s*11000/);
    assert.match(resultCss, /z-index:\s*11000/);
});

test('CharactersPanel + ScenesPanel gate overlay via shouldShowBatchProgressOverlay', () => {
    const chars = readFileSync(
        join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx'),
        'utf8',
    );
    const scenes = readFileSync(
        join(root, 'src/components/GameSettingEditor/ScenesPanel/ScenesPanel.tsx'),
        'utf8',
    );
    assert.match(chars, /shouldShowBatchProgressOverlay/);
    assert.match(chars, /showBatchNpcProgressOverlay/);
    assert.match(scenes, /shouldShowBatchProgressOverlay/);
    assert.match(scenes, /showBatchSceneProgressOverlay/);
    // 禁止仍用裸 isBatch*JobActive 直接挂遮罩（会复现压弹窗）
    assert.doesNotMatch(
        chars,
        /\{isBatchNpcJobActive && \(\s*\n\s*<div className=\{styles\.plusLoadingOverlay\}/,
    );
    assert.doesNotMatch(
        scenes,
        /\{isBatchSceneJobActive && \(\s*\n\s*<div className=\{styles\.plusLoadingOverlay\}/,
    );
});
