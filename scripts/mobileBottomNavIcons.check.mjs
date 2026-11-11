/**
 * 底部导航图标：按设计稿 SVG 路径接线回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('MobileBottomNavIcons_应按设计稿导出五枚图标且创作固定红底白加号', () => {
  const src = read('src/components/Layout/MobileBottomNavIcons.tsx');
  assert.match(src, /export function BottomNavHomeIcon/);
  assert.match(src, /export function BottomNavBookshelfIcon/);
  assert.match(src, /export function BottomNavCreateIcon/);
  assert.match(src, /export function BottomNavRankingsIcon/);
  assert.match(src, /export function BottomNavProfileIcon/);
  assert.match(src, /stroke="currentColor"/);
  assert.match(src, /fill="#D52D49"/);
  assert.match(src, /stroke="white"/);
  assert.match(src, /M179\.5 21H187\.5M187\.5 21H195\.5M187\.5 21V13M187\.5 21V29/);
  assert.match(src, /M48\.8333 31\.4995V22\.6576/);
  assert.match(src, /M106 31H127M107 11H111/);
  assert.match(src, /M267\.3 17\.7016/);
  assert.match(src, /M329\.5 22\.1111/);
});

test('MobileBottomNav_应改用内联设计图标而非 assetsv2 img', () => {
  const tsx = read('src/components/Layout/MobileBottomNav.tsx');
  const css = read('src/components/Layout/MobileBottomNav.module.css');
  assert.match(tsx, /BottomNavHomeIcon/);
  assert.match(tsx, /BottomNavBookshelfIcon/);
  assert.match(tsx, /BottomNavCreateIcon/);
  assert.match(tsx, /BottomNavRankingsIcon/);
  assert.match(tsx, /BottomNavProfileIcon/);
  assert.match(tsx, /data-bottom-nav="design-v2"/);
  assert.doesNotMatch(tsx, /assetsv2\/home\/(home|bookshelf|create|rank|mine)\.svg/);
  assert.doesNotMatch(tsx, /<img\s/);
  assert.match(css, /\.navItemActive[\s\S]*color:\s*#F16C83/);
  assert.match(css, /\.createIcon/);
  // 功能注释：创作钮必须按稿 40×32，禁止再缩回与两侧线框接近的尺寸
  assert.match(css, /\.createIcon\s*\{[^}]*width:\s*40px/);
  assert.match(css, /\.createIcon\s*\{[^}]*height:\s*32px/);
  assert.doesNotMatch(css, /\.createIcon\s*\{[^}]*(?:width:\s*30px|height:\s*24px)/);
  assert.match(css, /\.navItemCreate/);
  assert.match(tsx, /navItemCreate/);
  assert.doesNotMatch(css, /filter:\s*brightness\(0\)/);
});
