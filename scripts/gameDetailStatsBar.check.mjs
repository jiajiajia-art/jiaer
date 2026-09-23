/**
 * 作品详情统计条：内联图标 + 横排圆钮布局回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('GameDetailStatIcons_应导出分享心形星标内联SVG', () => {
  const src = read('src/components/GameDetailStatIcons.tsx');
  assert.match(src, /export function DetailShareIcon/);
  assert.match(src, /export function DetailHeartIcon/);
  assert.match(src, /export function DetailStarIcon/);
  assert.match(src, /stroke="currentColor"|fill="currentColor"/);
});

test('GameDetail_统计条应横排圆钮且使用内联图标组件', () => {
  const tsx = read('src/page/GameDetail.tsx');
  const css = read('src/page/GameDetail.module.css');
  assert.match(tsx, /DetailShareIcon/);
  assert.match(tsx, /DetailHeartIcon/);
  assert.match(tsx, /DetailStarIcon/);
  assert.match(tsx, /styles\.statsIconWrap/);
  assert.match(tsx, /styles\.statsText/);
  assert.doesNotMatch(tsx, /statsBar[\s\S]{0,800}icon_share\.(svg|webp)/);
  assert.match(css, /\.statsItem[\s\S]*flex-direction:\s*row/);
  assert.match(css, /\.statsIconWrap[\s\S]*border-radius:\s*999px/);
  assert.match(css, /\.statsIconWrap[\s\S]*background:\s*#2C2C2E/);
  assert.match(css, /\.statsBar[\s\S]*border-radius:\s*20px/);
  assert.match(css, /\.statsText[\s\S]*flex-direction:\s*column/);
});
