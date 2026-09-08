/**
 * 封面裁剪弹窗：对齐 funloom 墨黑账本，禁止白卡粉渐变主按钮
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('ImageCropModal_应对齐墨黑账本而非白卡粉按钮', () => {
  const css = read('src/components/CommonModal/ImageCropModal.module.css');
  const tsx = read('src/components/CommonModal/ImageCropModal.tsx');
  assert.match(css, /--crop-surface:\s*#1A1A1A/);
  assert.match(css, /--crop-input:\s*#1C1C1E/);
  assert.match(css, /--crop-accent:\s*#8E2135/);
  assert.match(css, /\.modal\s*\{[^}]*background:\s*var\(--crop-surface\)/);
  assert.match(css, /\.confirmBtn\s*\{[^}]*background:\s*var\(--crop-accent\)/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /border-radius:\s*999px/);
  assert.match(css, /\.cancelBtn\s*\{[^}]*background:\s*var\(--crop-input\)/);
  assert.doesNotMatch(css, /\.modal\s*\{[^}]*background:\s*#fff/);
  assert.doesNotMatch(css, /#e8575f|linear-gradient\(135deg,\s*#e03d4b/);
  assert.doesNotMatch(tsx, /IoClose|关闭\.png/);
  assert.match(tsx, />\s*×\s*</);
});
