/**
 * 视觉小说简介 / 章节 TOC 纯逻辑单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeNovelChapterIndex,
  chapterIndexFromLegacyChapters,
  resolveReadableStepIndex,
  resolveNovelSynopsisText,
  applyEditedChapterTitles,
  isGenericChapterTitle,
  enrichChapterTitlesFromSteps,
  formatChapterTocDisplay,
  buildFallbackChapterIndexFromSteps,
} from '../src/lib/galgame/novelChapters.ts';

test('normalizeNovelChapterIndex_应过滤非法并截断标题', () => {
  const list = normalizeNovelChapterIndex(
    [
      { id: 'a', title: '开篇很长很长很长很长很长很长很长很长很长很长很长很长', startStepIndex: 0, endStepIndex: 2 },
      { title: '', startStepIndex: 3, endStepIndex: 5 },
      { foo: 1 },
    ],
    6,
  );
  assert.equal(list.length, 2);
  assert.ok(list[0].title.length <= 40);
  assert.equal(list[1].title, '第2章');
});

test('normalizeNovelChapterIndex_空输入返回空', () => {
  assert.deepEqual(normalizeNovelChapterIndex(null, 3), []);
  assert.deepEqual(normalizeNovelChapterIndex([], 0), []);
});

test('chapterIndexFromLegacyChapters_应按顺序生成', () => {
  const list = chapterIndexFromLegacyChapters([
    { id: '1', title: '旧章一' },
    { title: '' },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, '旧章一');
  assert.equal(list[1].title, '第2章');
});

test('resolveReadableStepIndex_应跳过scene_change', () => {
  const steps = [
    { type: 'scene_change' },
    { type: 'narration' },
    { type: 'dialogue' },
  ];
  assert.equal(resolveReadableStepIndex(steps, 0), 1);
  assert.equal(resolveReadableStepIndex(steps, 2), 2);
});

test('resolveNovelSynopsisText_应裁剪空白', () => {
  assert.equal(resolveNovelSynopsisText('  简介  '), '简介');
  assert.equal(resolveNovelSynopsisText(null), '');
});

test('applyEditedChapterTitles_应按序改名', () => {
  const base = normalizeNovelChapterIndex(
    [
      { title: 'A', startStepIndex: 0, endStepIndex: 1 },
      { title: 'B', startStepIndex: 2, endStepIndex: 3 },
    ],
    4,
  );
  const next = applyEditedChapterTitles(base, ['城门', '  ']);
  assert.equal(next[0].title, '城门');
  assert.equal(next[1].title, 'B');
});

test('enrichChapterTitlesFromSteps_占位章名应用场景名补标题', () => {
  const steps = [
    { type: 'narration', content: '开场' },
    { type: 'scene_change', sceneName: '城门' },
    { type: 'dialogue', content: '快搬石头' },
  ];
  const enriched = enrichChapterTitlesFromSteps(
    [
      { id: 'ch_1', title: '第1章', startStepIndex: 0, endStepIndex: 0 },
      { id: 'ch_2', title: '第2章', startStepIndex: 1, endStepIndex: 2 },
    ],
    steps,
  );
  assert.equal(isGenericChapterTitle('第2章'), true);
  assert.equal(enriched[1].title, '城门');
  assert.equal(formatChapterTocDisplay(enriched[1], 1).title, '城门');
  assert.equal(formatChapterTocDisplay(enriched[1], 1).ordinal, '第2章');
});

test('buildFallbackChapterIndexFromSteps_应用场景名', () => {
  const list = buildFallbackChapterIndexFromSteps([
    { type: 'narration', content: '夜色' },
    { type: 'scene_change', sceneName: '破庙' },
    { type: 'narration', content: '破庙内' },
  ]);
  assert.ok(list.length >= 2);
  assert.equal(list[1].title, '破庙');
});
