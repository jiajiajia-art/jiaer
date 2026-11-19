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

test('Home_页根与强调色必须跟主题令牌', () => {
  const css = read('src/page/Home.module.css');
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?background:\s*var\(--color-bg\)/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--primary:\s*var\(--color-primary\)/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--primary-dark:\s*var\(--color-primary-bold\)/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*background:\s*#000000/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*--primary:\s*#A8283C/);
});

test('Footer_Rankings_Navbar登录色必须跟主题令牌', () => {
  const footer = read('src/components/Layout/FooterArea.module.css');
  const rankings = read('src/page/Rankings.module.css');
  const navbar = read('src/components/Layout/Navbar.module.css');
  assert.match(footer, /--footer-surface:\s*var\(--color-bg\)/);
  assert.doesNotMatch(footer, /--footer-surface:\s*#0A0A0A/);
  assert.match(rankings, /--rank-primary:\s*var\(--color-primary\)/);
  assert.match(rankings, /--rank-primary-deep:\s*var\(--color-primary-bold\)/);
  assert.match(
    navbar,
    /--navbar-login-bg:\s*linear-gradient\(180deg,\s*var\(--color-primary\)\s*0%,\s*var\(--color-primary-bold\)\s*100%\)/,
  );
  assert.doesNotMatch(navbar, /--navbar-login-bg:\s*linear-gradient\(180deg,\s*#b83248/i);
});

test('Galgame遮罩不得写死纯黑rgba', () => {
  const css = read('src/components/Galgame/NormalModeDisplay.module.css');
  assert.doesNotMatch(css, /background:\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.58\s*\)/);
  assert.match(css, /color-mix\(in srgb,\s*var\(--color-shadow\)\s*58%/);
});
