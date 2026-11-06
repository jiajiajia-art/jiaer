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

test('CreateType_PC内容区应居中且有合理max-width', () => {
  const css = read('src/page/CreateType.module.css');
  assert.match(css, /\.mainContent\s*\{[\s\S]*?justify-content:\s*center/);
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
