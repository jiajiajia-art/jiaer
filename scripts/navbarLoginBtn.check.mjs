/**
 * 导航「登录」须与首页「立即加入」同款酒红扁平胶囊
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const navbarCss = readFileSync(
  join(import.meta.dirname, '../src/components/Layout/Navbar.module.css'),
  'utf8'
);
const homeCss = readFileSync(
  join(import.meta.dirname, '../src/page/Home.module.css'),
  'utf8'
);

test('立即加入_使用酒红竖向渐变与内高光', () => {
  assert.match(
    homeCss,
    /\.mobileJoinGroupAction\s*\{[\s\S]*?background:\s*linear-gradient\(180deg,\s*(?:#b83248|var\(--color-primary\))\s*0%,\s*(?:#8e2135|var\(--color-primary-bold\))\s*100%\)/i
  );
});

test('navbar登录_应复用立即加入同款酒红渐变', () => {
  assert.match(
    navbarCss,
    /--navbar-login-bg:\s*linear-gradient\(180deg,\s*(?:#b83248|var\(--color-primary\))\s*0%,\s*(?:#8e2135|var\(--color-primary-bold\))\s*100%\)/i
  );
  assert.match(navbarCss, /--navbar-login-shadow:\s*inset 0 1px 0 (?:rgba\(255,\s*255,\s*255,\s*0\.12\)|var\(--|color-mix\()/);
  assert.match(navbarCss, /\.loginBtn\s*\{[\s\S]*?border-radius:\s*999px/);
});

test('navbar登录_禁止亮珊瑚外发光默认样式', () => {
  const head = navbarCss.slice(0, navbarCss.indexOf('.loginBtn'));
  assert.doesNotMatch(head, /--navbar-login-bg:\s*#fb4655/i);
  assert.doesNotMatch(head, /0 8px 22px rgba\(251,\s*70,\s*85/);
});
