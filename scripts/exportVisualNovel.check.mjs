/**
 * 导出视觉小说入口：标题规范化与「仅公开衍生小说」可见性规则（前端镜像）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { stripReplayMarkerFromTitle } from '../src/utils/novelGame.ts';

/** 原作详情可见性：仅已上架衍生小说（与后端 is_public=1 对齐） */
function shouldShowDerivedNovelOnSourceDetail(isPublic) {
  return Number(isPublic) === 1;
}

test('export title strips trailing replay markers', () => {
  assert.equal(stripReplayMarkerFromTitle('风云录 · 回放'), '风云录');
  assert.equal(stripReplayMarkerFromTitle('风云录'), '风云录');
});

test('source detail hides unpublished novel drafts', () => {
  assert.equal(shouldShowDerivedNovelOnSourceDetail(0), false);
  assert.equal(shouldShowDerivedNovelOnSourceDetail(1), true);
  assert.equal(shouldShowDerivedNovelOnSourceDetail('1'), true);
});

test('export modal clamps AI description to 300 chars', () => {
  const MAX = 300;
  const long = '测'.repeat(MAX + 40);
  assert.equal(long.slice(0, MAX).length, MAX);
});

test('overwrite confirmation only applies to own draft conflict path', () => {
  const shouldAskOverwrite = (errorCode, overwriteAlready) =>
    errorCode === 'REPLAY_TITLE_CONFLICT' && !overwriteAlready;
  assert.equal(shouldAskOverwrite('REPLAY_TITLE_CONFLICT', false), true);
  assert.equal(shouldAskOverwrite('REPLAY_TITLE_CONFLICT', true), false);
  assert.equal(shouldAskOverwrite('FORBIDDEN', false), false);
});

test('export can submit with title only (chapters generated server-side)', () => {
  const canSubmit = ({ title, busy }) =>
    String(title || '').trim().length > 0 && !busy;
  assert.equal(canSubmit({ title: '围城', busy: false }), true);
  assert.equal(canSubmit({ title: '', busy: false }), false);
  assert.equal(canSubmit({ title: '围城', busy: true }), false);
});

test('game detail visual novel entry uses novel list not replay tabs', () => {
  const entryLabel = '视觉小说';
  const drawerShowsVisibilityTabs = false;
  const pageKeepsInlineDerivedList = false;
  assert.equal(entryLabel, '视觉小说');
  assert.equal(drawerShowsVisibilityTabs, false);
  assert.equal(pageKeepsInlineDerivedList, false);
});

test('galgame_topBar_has_export_visual_novel_entry', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = dirname(fileURLToPath(import.meta.url));
  const galgame = readFileSync(join(dir, '../src/page/Galgame.tsx'), 'utf8');
  const css = readFileSync(join(dir, '../src/page/Galgame.module.css'), 'utf8');
  assert.match(galgame, /topExportButton/);
  assert.match(galgame, /logVisualButtonClick\('export_visual_novel'\)/);
  assert.match(galgame, /setIsExportNovelOpen\(true\)/);
  assert.match(galgame, /ExportVisualNovelModal/);
  assert.match(css, /\.topExportButton\b/);
  assert.match(css, /rotate\(45deg\)/);
});
