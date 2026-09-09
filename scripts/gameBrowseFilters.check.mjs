/**
 * 首页/分类模式筛选单测：小说独立快捷入口与公开列表模式
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_LIST_MODE_OPTIONS,
  HOME_NOVEL_QUICK_FILTER_MODE,
  normalizeHomeListMode,
  normalizeHomeListSort,
  resolveCategoriesPageTitleKey,
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

test('normalizeHomeListSort_应识别hot推荐最新', () => {
  assert.equal(normalizeHomeListSort('hot'), 'hot');
  assert.equal(normalizeHomeListSort('recommended'), 'recommended');
  assert.equal(normalizeHomeListSort('latest'), 'latest');
  assert.equal(normalizeHomeListSort(null), 'recommended');
  assert.equal(normalizeHomeListSort('unknown'), 'recommended');
});

test('resolveCategoriesPageTitleKey_最热应为最热推荐文案键', () => {
  assert.equal(resolveCategoriesPageTitleKey('hot'), 'categories.pageTitles.hot');
  assert.equal(resolveCategoriesPageTitleKey('recommended'), 'categories.pageTitles.recommended');
  assert.equal(resolveCategoriesPageTitleKey('latest'), 'categories.pageTitles.latest');
});

test('en_gameBrowse_modes_novel应为Visual Novel而非中文残留', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const en = JSON.parse(readFileSync(join(root, 'src/i18n/locales/en.json'), 'utf8'));
  assert.equal(en.gameBrowse.modes.novel, 'Visual Novel');
  assert.equal(en.categories.modes.novel, 'Visual Novel');
  assert.equal(en.create.draftFilters.novel, 'Visual Novel');
  assert.doesNotMatch(en.gameBrowse.modes.novel, /视觉小说/);
});
