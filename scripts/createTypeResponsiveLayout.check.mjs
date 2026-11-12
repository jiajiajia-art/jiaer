/**
 * 创作类型页：PC 居中单列（与移动端同结构），禁止贴左半屏空区
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('CreateType_PC内容区应顶对齐且水平居中_禁止垂直居中留白', () => {
  const css = read('src/page/CreateType.module.css');
  const mainContent = css.match(/\.mainContent\s*\{([^}]*)\}/)?.[1] ?? '';
  // 功能注释：壳层 flex-column 下若写 justify-content:center 会垂直居中，顶栏下出现大块空余
  assert.match(mainContent, /justify-content:\s*flex-start/);
  assert.match(mainContent, /align-items:\s*center/);
  assert.doesNotMatch(mainContent, /justify-content:\s*center\b/);
  assert.match(css, /\.content\s*\{[\s\S]*?max-width:\s*560px/);
  assert.match(css, /\.content\s*\{[\s\S]*?margin:\s*0\s+auto/);
  // 禁止再铺满整个 shell-max 多列拉宽
  assert.doesNotMatch(css, /\.content\s*\{[^}]*--app-desktop-shell-max/);
  assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(3/);
});

test('CreateType_类型列表PC与移动端均为单列', () => {
  const css = read('src/page/CreateType.module.css');
  const tsx = read('src/page/CreateType.tsx');
  assert.match(tsx, /pageStyles\.options/);
  assert.match(css, /\.content\s+\.options\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.romanceSubOptions\s*\{[\s\S]*?flex-direction:\s*column/);
});

test('CreateType_活动入口应对齐暗色主站白灰文案_禁止品红金色酒红正文色', () => {
  const css = read('src/page/CreateType.module.css');
  assert.match(css, /--activity-accent:\s*(?:rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.78\s*\)|var\(--|color-mix\()/);
  assert.doesNotMatch(css, /--activity-accent:\s*#b30047/i);
  assert.doesNotMatch(css, /--activity-accent:\s*#A8283C/i);
  assert.doesNotMatch(css, /rgba\(\s*216\s*,\s*174\s*,\s*104/);
  assert.match(css, /\.moreActivitiesIcon\s*\{[\s\S]*?color:\s*var\(--activity-accent\)/);
  assert.match(css, /\.moreActivitiesAction\s*\{[\s\S]*?color:\s*var\(--activity-accent\)/);
});

test('CreateType弹窗取消按钮应对齐选项卡_禁止右下角透明胶囊', () => {
  const css = read('src/components/CreateGame/CreateGameModals.module.css');
  const cancel = css.match(/\.createTypeCancelButton\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(cancel, /width:\s*100%/);
  assert.match(cancel, /border-radius:\s*14px/);
  assert.match(cancel, /background-color:\s*var\(--type-card\)/);
  assert.doesNotMatch(cancel, /border-radius:\s*999px/);
  assert.doesNotMatch(cancel, /background-color:\s*transparent/);
});

test('CreateType_禁止再叠navbar高度padding_避免顶栏下大块空白', () => {
  const css = read('src/page/CreateType.module.css');
  assert.doesNotMatch(css, /padding-top:\s*calc\(\s*var\(--app-(?:desktop|mobile)-navbar-height\)/);
  assert.doesNotMatch(css, /padding-top:\s*var\(--app-navbar-offset\)/);
  const mobile = css.match(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*?\.mainContent\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(mobile, /padding:\s*8px\s+16px\s+100px/);
});
