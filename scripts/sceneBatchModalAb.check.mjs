/**
 * 场景批量弹窗展示 A/B（严格）：完成态不得再显示「请勿离开 / 取消」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isBatchSceneBoardAllSuccess,
    shouldShowRetryIncompleteBatchTasks,
} from '../src/utils/batchNpcBoardSettlement.ts';

/** 与 ScenesPanel 同口径的文案/按钮决策（无 React） */
function resolveSceneBatchModalView(items, totalCount, { isGenerating = true } = {}) {
    const allSuccess = isBatchSceneBoardAllSuccess(items, totalCount);
    const showRetry = shouldShowRetryIncompleteBatchTasks(items, totalCount);
    const running = isGenerating && !showRetry && !allSuccess;
    const title = showRetry
        ? '场景背景生成结束'
        : allSuccess
            ? '场景背景已全部生成'
            : '正在生成场景立绘...';
    const showDoNotLeave = showRetry || running;
    const warnText = showRetry
        ? '未完成项可重试'
        : running
            ? '正在生成中，请勿离开当前页面或重复操作'
            : '';
    const primaryAction = (showRetry || allSuccess) ? '关闭' : '取消';
    const showFootSpacer = false; // 禁止左侧空白占位
    const showContinue = showRetry;
    return {
        allSuccess,
        showRetry,
        running,
        title,
        showDoNotLeave,
        warnText,
        primaryAction,
        showFootSpacer,
        showContinue,
        hideGeneratingCopy: allSuccess || showRetry,
    };
}

test('A_进行中_显示请勿离开与取消', () => {
    const items = [
        { stage: 'item_done' },
        { stage: 'generate_start' },
        { stage: 'pending' },
    ];
    const v = resolveSceneBatchModalView(items, 3, { isGenerating: true });
    assert.equal(v.running, true);
    assert.equal(v.showDoNotLeave, true);
    assert.match(v.warnText, /请勿离开/);
    assert.equal(v.primaryAction, '取消');
    assert.equal(v.showFootSpacer, false);
});

test('B_全成功6项_隐藏请勿离开_按钮为关闭_无左侧占位', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
        stage: i % 2 === 0 ? 'item_done' : 'generate_done',
        index: i,
    }));
    const v = resolveSceneBatchModalView(items, 6, { isGenerating: true });
    assert.equal(v.allSuccess, true);
    assert.equal(v.running, false);
    assert.equal(v.showDoNotLeave, false);
    assert.equal(v.warnText, '');
    assert.equal(v.title, '场景背景已全部生成');
    assert.equal(v.primaryAction, '关闭');
    assert.equal(v.showContinue, false);
    assert.equal(v.showFootSpacer, false);
    assert.equal(v.hideGeneratingCopy, true);
});

test('B_全成功但job仍running_不得再显示生成中标题', () => {
    const items = Array.from({ length: 6 }, () => ({ stage: 'item_done' }));
    const v = resolveSceneBatchModalView(items, 6, { isGenerating: true });
    assert.notEqual(v.title, '正在生成场景立绘...');
    assert.equal(v.primaryAction, '关闭');
});
