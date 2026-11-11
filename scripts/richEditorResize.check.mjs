/**
 * 简介编辑器高度拖拽钳制 + 手柄可见图标
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RICH_EDITOR_DEFAULT_HEIGHT_PX,
  RICH_EDITOR_MIN_HEIGHT_PX,
  clampRichEditorHeight,
  resolveRichEditorMaxHeightPx,
} from '../src/utils/richEditorResize.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

test('SimpleRichTextEditor_拖高手柄应有对角图标且暗色不盖底', () => {
  const tsx = readFileSync(join(root, 'src/components/Common/SimpleRichTextEditor.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/Common/SimpleRichTextEditor.module.css'), 'utf8');
  const customCss = readFileSync(join(root, 'src/page/CustomIFCreate.module.css'), 'utf8');
  assert.match(tsx, /MdSouthEast/);
  assert.match(tsx, /data-rich-editor-resize/);
  assert.match(tsx, /resizeHandleIcon/);
  assert.match(css, /\.resizeHandleIcon\s*\{/);
  assert.match(customCss, /button:not\(\[data-rich-editor-resize\]\)/);
  assert.match(customCss, /\[data-rich-editor-resize\]\s*\{[\s\S]*?background:\s*transparent/);
});
