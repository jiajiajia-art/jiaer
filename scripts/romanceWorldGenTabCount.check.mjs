/**
 * 生成世界编辑器选中页签上的已填数量必须是深字白底。
 * 开关滑块会把 class 里含 bg-white 的圆角 span 刷成白底，数字再写 text-white 就会看不见。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const css = readFileSync(join(root, 'Romance/src/index.css'), 'utf8');

test('选中页签数量_深字白底且不走bg-white', () => {
  assert.match(panel, /wg-tab-count rounded-full/);
  assert.match(panel, /on \? "is-on"/);
  assert.doesNotMatch(panel, /bg-white\/25 text-white/);
  assert.match(css, /\.world-gen-editor button\[aria-pressed="true"\] \.wg-tab-count\.is-on/);
  assert.match(css, /background-color: #ffffff !important;/);
  assert.match(css, /color: #6e1228 !important;/);
  assert.match(css, /bg-white"\]:not\(\.wg-tab-count\)/);
});
