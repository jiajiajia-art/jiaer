/**
 * 首页视觉小说快捷筛与题材互斥规则单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveHomeFiltersForNovelThemeConflict } from '../src/utils/homeFilterNovelTheme.ts';

const base = {
  mode: 'all',
  sort: 'latest',
  tagId: null,
};

test('entering novel mode clears theme tag', () => {
  const next = resolveHomeFiltersForNovelThemeConflict(
    { ...base, tagId: 12 },
    { mode: 'novel' },
  );
  assert.equal(next.mode, 'novel');
  assert.equal(next.tagId, null);
});

test('picking theme while novel exits novel to all', () => {
  const next = resolveHomeFiltersForNovelThemeConflict(
    { ...base, mode: 'novel' },
    { tagId: 12 },
  );
  assert.equal(next.mode, 'all');
  assert.equal(next.tagId, 12);
});

test('picking theme under role-playing keeps mode', () => {
  const next = resolveHomeFiltersForNovelThemeConflict(
    { ...base, mode: 'role-playing' },
    { tagId: 12 },
  );
  assert.equal(next.mode, 'role-playing');
  assert.equal(next.tagId, 12);
});
