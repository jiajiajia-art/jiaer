/**
 * 分类页标签横滑换算回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const scrollMod = await import(join(root, 'src/utils/horizontalChipScroll.ts'));

const {
  computeDragScrollLeft,
  shouldConvertWheelToHorizontal,
  applyWheelDeltaToHorizontalScroll,
  shouldHandlePointerAsMouseDrag,
  createHorizontalDragState,
} = scrollMod;

test('computeDragScrollLeft_应随指针左移增大scrollLeft', () => {
  assert.equal(computeDragScrollLeft(40, 100, 70), 70);
  assert.equal(computeDragScrollLeft(0, 50, 80), -30);
});

test('shouldConvertWheelToHorizontal_仅纵向占优时为真', () => {
  assert.equal(shouldConvertWheelToHorizontal(0, 20), true);
  assert.equal(shouldConvertWheelToHorizontal(30, 10), false);
  assert.equal(shouldConvertWheelToHorizontal(10, 10), false);
});

test('applyWheelDeltaToHorizontalScroll_应夹紧且无溢出时不改动', () => {
  assert.deepEqual(
    applyWheelDeltaToHorizontalScroll(0, 100, 100, 40),
    { nextScrollLeft: 0, changed: false },
  );
  assert.deepEqual(
    applyWheelDeltaToHorizontalScroll(10, 300, 100, 50),
    { nextScrollLeft: 60, changed: true },
  );
  assert.deepEqual(
    applyWheelDeltaToHorizontalScroll(180, 300, 100, 50),
    { nextScrollLeft: 200, changed: true },
  );
});

test('shouldHandlePointerAsMouseDrag_仅鼠标主键', () => {
  assert.equal(shouldHandlePointerAsMouseDrag('mouse', 0), true);
  assert.equal(shouldHandlePointerAsMouseDrag('touch', 0), false);
  assert.equal(shouldHandlePointerAsMouseDrag('mouse', 2), false);
});

test('createHorizontalDragState_应为空闲态', () => {
  assert.deepEqual(createHorizontalDragState(), {
    isDragging: false,
    pointerId: null,
    hasCaptured: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
});

test('Categories_应使用推荐内容玩法文案与卡外标题布局', () => {
  const tsx = readFileSync(join(root, 'src/page/Categories.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/page/Categories.module.css'), 'utf8');
  const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');
  assert.match(tsx, /styles\.pageHeader/);
  assert.match(tsx, /<Navbar\s*\/>/);
  assert.doesNotMatch(tsx, /filtersCardHead/);
  assert.match(css, /\.filterSection\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.match(css, /\.tagChipActive\s*\{[^}]*background:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.match(zh, /"pageTitle":\s*"推荐内容"/);
  assert.match(zh, /"pageTitles"[\s\S]*"hot":\s*"最热推荐"/);
  assert.match(zh, /"mode":\s*"玩法"/);
});
