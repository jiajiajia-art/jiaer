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
  // 功能注释：线框图标统一 24 viewBox，描边走 currentColor 对象展开，避免设计稿切片大小不一
  assert.match(src, /stroke: 'currentColor'/);
  assert.match(src, /viewBox: '0 0 24 24'/);
  assert.match(src, /fill="(?:#D52D49"|var\(--|color-mix\()/);
  assert.match(src, /stroke="white"/);
  assert.match(src, /M3\.5 10\.2L12 3\.5l8\.5 6\.7/);
  assert.match(src, /M4 20\.5h16/);
  assert.match(src, /M12 16h8m0 0h8m-8 0V8m0 8v8/);
  assert.match(src, /M4\.5 19\.5h15/);
  assert.match(src, /M5\.5 19\.5c0-3\.1 2\.9-5\.5 6\.5-5\.5s6\.5 2\.4 6\.5 5\.5/);
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
  assert.match(css, /\.navItemActive[\s\S]*color:\s*(?:#F16C83|var\(--|color-mix\()/);
  assert.match(css, /\.createIcon/);
  // 功能注释：创作钮略大于两侧线框，锁在 42×32，禁止再缩回 30×24
  assert.match(css, /\.createIcon\s*\{[^}]*width:\s*42px/);
  assert.match(css, /\.createIcon\s*\{[^}]*height:\s*32px/);
  assert.doesNotMatch(css, /\.createIcon\s*\{[^}]*(?:width:\s*30px|height:\s*24px)/);
  assert.match(css, /\.navItemCreate/);
  assert.match(tsx, /navItemCreate/);
  assert.doesNotMatch(css, /filter:\s*brightness\(0\)/);
});
