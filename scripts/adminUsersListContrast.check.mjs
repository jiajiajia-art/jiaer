/**
 * 用户角色列表：浅底必须显式深色字，禁止继承全站 body 白字
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/components/AdminUsersManager.module.css'), 'utf8');
const tsx = readFileSync(join(root, 'src/components/AdminUsersManager.tsx'), 'utf8');

test('AdminUsersManager_列表单元格应显式使用admin墨色', () => {
  assert.match(css, /\.root\s*\{[\s\S]*?color:\s*var\(--admin-text/);
  assert.match(css, /\.table\s*\{[\s\S]*?color:\s*var\(--admin-text/);
  assert.match(css, /\.table th,\s*\.table td\s*\{[\s\S]*?color:\s*var\(--admin-text/);
  assert.match(css, /\.input,\s*\.select\s*\{[\s\S]*?color:\s*var\(--admin-text/);
});

test('AdminUsersManager_应渲染昵称用户ID手机号列', () => {
  assert.match(tsx, /user\.nickname/);
  assert.match(tsx, /user\.userId/);
  assert.match(tsx, /user\.phoneNumber/);
  assert.match(tsx, /adminUsers\.nickname/);
});
