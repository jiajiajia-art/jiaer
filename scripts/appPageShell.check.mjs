/**
 * 全站页面壳：顶/底栏固定 + 安全区；中间内容用剩余视口单独滚动，禁止各页写死顶栏上边距。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('index_css_定义navbar与bottom_nav_offset含安全区', () => {
  const css = read('src/index.css');
  assert.match(css, /--app-navbar-offset:\s*calc\(var\(--app-desktop-navbar-height\) \+ env\(safe-area-inset-top/);
  assert.match(css, /--app-bottom-nav-offset:\s*calc\(72px \+ env\(safe-area-inset-bottom/);
});

test('Navbar_高度含顶部安全区_对齐offset', () => {
  const css = read('src/components/Layout/Navbar.module.css');
  assert.match(css, /height:\s*var\(--app-navbar-offset\)/);
  assert.match(css, /padding-top:\s*env\(safe-area-inset-top/);
  assert.doesNotMatch(css, /@media \(max-width:\s*768px\)[\s\S]{0,400}?height:\s*60px;/);
});

test('AppPageShell_中间区用剩余视口单独滚动', () => {
  const tsx = read('src/components/Layout/AppPageShell.tsx');
  const css = read('src/components/Layout/AppPageShell.module.css');
  assert.match(tsx, /data-app-page-shell/);
  assert.match(tsx, /data-app-page-main/);
  assert.match(css, /top:\s*var\(--app-navbar-offset\)/);
  assert.match(css, /bottom:\s*var\(--app-bottom-nav-offset\)/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /100dvh/);
});

test('CreateWorks_书架走AppPageShell_不写死顶栏边距', () => {
  const page = read('src/page/CreateWorks.tsx');
  assert.match(page, /AppPageShell/);
  assert.doesNotMatch(page, /<Navbar/);
  assert.doesNotMatch(page, /<MobileBottomNav/);
});

test('Create_Rankings_Search_Bookshelf_Favorites_Library_CreateType_走统一壳', () => {
  for (const rel of [
    'src/page/Create.tsx',
    'src/page/Rankings.tsx',
    'src/page/Search.tsx',
    'src/page/Bookshelf.tsx',
    'src/page/Favorites.tsx',
    'src/page/Library.tsx',
    'src/page/CreateType.tsx',
    'src/page/CreatePlatformApp.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /AppPageShell/, `${rel} missing AppPageShell`);
    assert.doesNotMatch(src, /<Navbar\s*\/>/, `${rel} still mounts bare Navbar`);
    assert.doesNotMatch(src, /<MobileBottomNav/, `${rel} still mounts bare MobileBottomNav`);
  }
});
