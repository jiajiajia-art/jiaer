/**
 * novelContentWindow 单测：阈值、区间合并、缺失窗口、虚拟下标
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyNovelWindowToBuffer,
  buildBufferedDisplaySteps,
  bufferFromFullSteps,
  computeChapterFetchWindow,
  computeMissingNovelWindow,
  computeVirtualIndexWindow,
  createEmptyNovelStepBuffer,
  mergeNovelStepRanges,
  novelRangesCover,
  NOVEL_VIRTUAL_STEP_THRESHOLD,
  NOVEL_WINDOW_STEP_THRESHOLD,
  shouldUseNovelVirtualList,
  shouldUseNovelWindowMode,
} from '../src/lib/galgame/novelContentWindow.ts';

test('shouldUseNovelWindowMode_短篇否长篇是', () => {
  assert.equal(shouldUseNovelWindowMode({ stepCount: 10 }), false);
  assert.equal(shouldUseNovelWindowMode({ stepCount: NOVEL_WINDOW_STEP_THRESHOLD }), true);
  assert.equal(shouldUseNovelWindowMode({ stepCount: 1, contentLayout: 'segmented' }), true);
});

test('shouldUseNovelVirtualList_达阈值启用', () => {
  assert.equal(shouldUseNovelVirtualList(10), false);
  assert.equal(shouldUseNovelVirtualList(NOVEL_VIRTUAL_STEP_THRESHOLD), true);
});

test('mergeNovelStepRanges_应合并重叠区间', () => {
  const merged = mergeNovelStepRanges([
    { from: 0, to: 10 },
    { from: 8, to: 20 },
    { from: 30, to: 40 },
  ]);
  assert.deepEqual(merged, [
    { from: 0, to: 20 },
    { from: 30, to: 40 },
  ]);
});

test('novelRangesCover_与computeMissingNovelWindow', () => {
  const ranges = [{ from: 0, to: 100 }];
  assert.equal(novelRangesCover(ranges, 10, 50), true);
  assert.equal(computeMissingNovelWindow(ranges, 0, 50, 200), null);
  const miss = computeMissingNovelWindow(ranges, 90, 50, 200);
  assert.ok(miss);
  assert.equal(miss.from, 90);
});

test('applyNovelWindowToBuffer_应写入全局下标', () => {
  let buffer = createEmptyNovelStepBuffer(5);
  buffer = applyNovelWindowToBuffer(buffer, 2, [
    { type: 'narration', content: 'a' },
    { type: 'narration', content: 'b' },
  ], { totalStepCount: 5 });
  assert.equal(buffer.stepsByIndex.get(2).content, 'a');
  assert.equal(novelRangesCover(buffer.ranges, 2, 4), true);
  const display = buildBufferedDisplaySteps(buffer, 2, 4);
  assert.equal(display.length, 2);
  assert.equal(display[0].globalStepIndex, 2);
});

test('computeChapterFetchWindow_应含pad', () => {
  const win = computeChapterFetchWindow(
    { startStepIndex: 100, endStepIndex: 119 },
    200,
    20,
  );
  assert.equal(win.from, 80);
  assert.ok(win.limit >= 40);
});

test('computeVirtualIndexWindow_应含overscan', () => {
  const win = computeVirtualIndexWindow({
    scrollTop: 1200,
    viewportHeight: 600,
    totalCount: 1000,
    estimateHeight: 100,
    overscan: 5,
  });
  assert.equal(win.start, 7); // 12-5
  assert.ok(win.end > win.start);
});

test('bufferFromFullSteps_应覆盖全文', () => {
  const buffer = bufferFromFullSteps(
    [{ type: 'narration', content: '1' }, { type: 'narration', content: '2' }],
    [{ id: 'ch_1', title: '开篇', startStepIndex: 0, endStepIndex: 1 }],
  );
  assert.equal(buffer.totalStepCount, 2);
  assert.equal(novelRangesCover(buffer.ranges, 0, 2), true);
});
