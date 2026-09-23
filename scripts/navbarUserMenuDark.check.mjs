/**
 * 头像下拉菜单：对齐 funloom 墨黑片 + 酒红退出，禁止白底粉条旧稿
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const navbarCss = readFileSync(
  join(import.meta.dirname, '../src/components/Layout/Navbar.module.css'),
  'utf8'
);

/** 取 .navbarContainer 根令牌块（不含移动端 media） */
const rootBlock = navbarCss.slice(
  navbarCss.indexOf('.navbarContainer'),
  navbarCss.indexOf('@media (max-width: 1080px)')
);

test('navbar头像菜单_桌面默认应为墨黑底白字', () => {
  assert.match(rootBlock, /--navbar-menu-bg:\s*#1C1C1E/i);
  assert.match(rootBlock, /--navbar-menu-text:\s*#FFFFFF/i);
  assert.match(rootBlock, /--navbar-menu-border:\s*rgba\(255,\s*255,\s*255,\s*0\.1\)/);
  assert.doesNotMatch(rootBlock, /--navbar-menu-bg:\s*rgba\(255,\s*255,\s*255/);
  assert.doesNotMatch(rootBlock, /--navbar-menu-text:\s*#111827/);
});

test('navbar头像菜单_退出应为酒红扁平渐变而非亮珊瑚', () => {
  assert.match(
    rootBlock,
    /--navbar-menu-logout-bg:\s*linear-gradient\(180deg,\s*#b83248\s*0%,\s*#8e2135\s*100%\)/i
  );
  assert.match(navbarCss, /\.logoutBtn\s*\{[\s\S]*?background:\s*var\(--navbar-menu-logout-bg\)/);
  assert.doesNotMatch(navbarCss, /\.logoutBtn\s*\{[\s\S]*?#FB4655/i);
  assert.doesNotMatch(navbarCss, /\.menuBtn:hover\s*\{[\s\S]*?color:\s*var\(--primary\)/);
});
