/**
 * 首页/分类模式筛选单测：小说独立快捷入口与公开列表模式
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_LIST_MODE_OPTIONS,
  HOME_NOVEL_QUICK_FILTER_MODE,
  normalizeHomeListMode,
} from '../src/utils/gameBrowseFilters.ts';

test('HOME_LIST_MODE_OPTIONS includes novel after interactive-video', () => {
  const values = HOME_LIST_MODE_OPTIONS.map((option) => option.value);
  assert.deepEqual(values, ['all', 'role-playing', 'world', 'custom', 'interactive-video', 'novel']);
  assert.equal(HOME_NOVEL_QUICK_FILTER_MODE, 'novel');
  const novel = HOME_LIST_MODE_OPTIONS.find((option) => option.value === 'novel');
  assert.equal(novel?.label, '视觉小说');
});

test('HOME_LIST_MODE_OPTIONS role-playing display label is AI文游', () => {
  const rolePlaying = HOME_LIST_MODE_OPTIONS.find((option) => option.value === 'role-playing');
  assert.ok(rolePlaying);
  assert.equal(rolePlaying.label, 'AI文游');
});

test('HOME_LIST_MODE_OPTIONS world display label is 酒馆卡', () => {
  const world = HOME_LIST_MODE_OPTIONS.find((option) => option.value === 'world');
  assert.ok(world);
  assert.equal(world.label, '酒馆卡');
});

test('normalizeHomeListMode accepts novel alias', () => {
  assert.equal(normalizeHomeListMode('novel'), 'novel');
  assert.equal(normalizeHomeListMode('all'), 'all');
  assert.equal(normalizeHomeListMode('world'), 'world');
  assert.equal(normalizeHomeListMode('avg'), 'world');
});
