/**
 * 作品详情统计条：描边三钮 + 横排「点赞 N」接线回归。
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

test('GameDetail_统计条应描边横排且使用内联图标组件', () => {
  const tsx = read('src/page/GameDetail.tsx');
  const css = read('src/page/GameDetail.module.css');
  assert.match(tsx, /DetailShareIcon/);
  assert.match(tsx, /DetailHeartIcon/);
  assert.match(tsx, /DetailStarIcon/);
  assert.match(tsx, /DetailRateIcon/);
  assert.match(tsx, /styles\.statsText/);
  /* 功能注释：分享已迁顶栏；互动行是点赞/收藏/评分，文案在前数字在后 */
  assert.match(tsx, /styles\.statsBar[\s\S]*?DetailHeartIcon[\s\S]*?DetailStarIcon[\s\S]*?DetailRateIcon/);
  assert.match(tsx, /styles\.statsLabel[\s\S]*?gameDetail\.like[\s\S]*?styles\.statsValue/);
  assert.doesNotMatch(tsx, /styles\.statsBar[\s\S]*?DetailShareIcon/);
  assert.doesNotMatch(tsx, /statsBar[\s\S]{0,800}icon_share\.(svg|webp)/);
  assert.doesNotMatch(tsx, /styles\.statsIconWrap/);
  assert.match(css, /\.statsItem[\s\S]*flex-direction:\s*row/);
  assert.match(css, /\.statsItem[\s\S]*border-radius:\s*11\.5px/);
  assert.match(css, /\.statsItem[\s\S]*border:\s*1px\s+solid/);
  assert.match(css, /\.statsItem[\s\S]*background:\s*var\(--detail-card\)/);
  assert.match(css, /\.statsBar[\s\S]*gap:\s*0\.55rem/);
  assert.match(css, /\.statsText[\s\S]*flex-direction:\s*row/);
});
