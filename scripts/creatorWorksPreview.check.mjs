/**
 * 创作页作品预览：PC 铺满已加载列表，手机默认 2 条。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WORKS_DESKTOP_PREVIEW_SIZE,
  WORKS_MOBILE_PREVIEW_SIZE,
  WORKS_PAGE_SIZE,
  resolveWorksListLimit,
  shouldShowWorksViewAll,
} from '../src/utils/creatorWorksPreview.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('resolveWorksListLimit_PC预览铺满手机只露两条', () => {
  assert.equal(resolveWorksListLimit({ mode: 'preview', isMobile: false }), WORKS_DESKTOP_PREVIEW_SIZE);
  assert.equal(resolveWorksListLimit({ mode: 'preview', isMobile: true }), WORKS_MOBILE_PREVIEW_SIZE);
  assert.equal(WORKS_MOBILE_PREVIEW_SIZE, 2);
  assert.ok(WORKS_DESKTOP_PREVIEW_SIZE >= 10);
  assert.equal(resolveWorksListLimit({ mode: 'full', isMobile: false }), WORKS_PAGE_SIZE);
  assert.equal(resolveWorksListLimit({ mode: 'full', isMobile: true }), WORKS_PAGE_SIZE);
});

test('shouldShowWorksViewAll_仅手机预览显示全部入口', () => {
  assert.equal(shouldShowWorksViewAll({ mode: 'preview', isMobile: true }), true);
  assert.equal(shouldShowWorksViewAll({ mode: 'preview', isMobile: false }), false);
  assert.equal(shouldShowWorksViewAll({ mode: 'full', isMobile: true }), false);
});

test('CreatorWorksPanel_预览条数走resolveWorksListLimit', () => {
  const panel = read('src/components/Create/CreatorWorksPanel.tsx');
  assert.match(panel, /resolveWorksListLimit/);
  assert.match(panel, /shouldShowWorksViewAll/);
  assert.match(panel, /WORKS_MOBILE_MEDIA/);
  assert.doesNotMatch(panel, /WORKS_PREVIEW_SIZE\s*=\s*2/);
  const css = read('src/page/Create.module.css');
  assert.match(css, /@media \(min-width:\s*769px\)[\s\S]*?\.worksViewAllSlot\s*\{[\s\S]*?display:\s*none/);
});
