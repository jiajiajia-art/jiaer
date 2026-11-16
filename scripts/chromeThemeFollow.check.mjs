/**
 * 功能注释：外观设置切浅色时，移动端顶栏/底栏必须跟 --color-bg，禁止再锁死黑底。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('theme-base_深色bg仍为黑以保证暗色壳观感', () => {
  const base = read('src/styles/themes/theme-base.css');
  assert.match(base, /\[data-theme\]\[data-mode="dark"\][\s\S]*--color-bg:\s*#000000/);
});

test('Navbar_移动端surface必须用color-bg令牌', () => {
  const css = read('src/components/Layout/Navbar.module.css');
  assert.match(css, /--navbar-surface:\s*var\(--color-bg\)/);
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*768px\)[\s\S]{0,400}--navbar-surface:\s*#000000/,
  );
});

test('MobileBottomNav_底栏背景与选中色必须用主题令牌', () => {
  const css = read('src/components/Layout/MobileBottomNav.module.css');
  assert.match(css, /background:\s*var\(--color-bg\)/);
  assert.match(css, /\.navItemActive[\s\S]*color:\s*var\(--color-primary-fg\)/);
  assert.doesNotMatch(css, /background:\s*#000000/);
  assert.doesNotMatch(css, /\.navItemActive[\s\S]*color:\s*#F16C83/);
});
