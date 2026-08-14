/**
 * 简介编辑器高度拖拽钳制
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RICH_EDITOR_DEFAULT_HEIGHT_PX,
  RICH_EDITOR_MIN_HEIGHT_PX,
  clampRichEditorHeight,
  resolveRichEditorMaxHeightPx,
} from '../src/utils/richEditorResize.ts';

test('resolveRichEditorMaxHeightPx_uses viewport ratio with cap', () => {
  assert.equal(resolveRichEditorMaxHeightPx(1000), 800);
  assert.equal(resolveRichEditorMaxHeightPx(2000), 960);
  assert.ok(resolveRichEditorMaxHeightPx(100) >= RICH_EDITOR_MIN_HEIGHT_PX);
});

test('clampRichEditorHeight_clamps to min and max', () => {
  assert.equal(clampRichEditorHeight(10, { min: 140, max: 400 }), 140);
  assert.equal(clampRichEditorHeight(999, { min: 140, max: 400 }), 400);
  assert.equal(clampRichEditorHeight(220.6, { min: 140, max: 400 }), 221);
  assert.equal(clampRichEditorHeight(Number.NaN, { min: 140, max: 400 }), 140);
  assert.equal(RICH_EDITOR_DEFAULT_HEIGHT_PX, 220);
});
