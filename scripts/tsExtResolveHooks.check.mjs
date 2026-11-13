/**
 * 功能注释：单测入口须挂 ts-ext-resolve-hooks，否则 Romance 相对路径在 Node 下会 MODULE_NOT_FOUND。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('package_json_test脚本须import_ts-ext-resolve-hooks', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(String(pkg.scripts?.test || ''), /ts-ext-resolve-hooks\.mjs/);
});

test('hooks须register_ts-ext-loader', () => {
  const hooks = readFileSync(join(root, 'scripts/ts-ext-resolve-hooks.mjs'), 'utf8');
  const loader = readFileSync(join(root, 'scripts/ts-ext-loader.mjs'), 'utf8');
  assert.match(hooks, /register\(/);
  assert.match(hooks, /ts-ext-loader\.mjs/);
  assert.match(loader, /export async function resolve/);
  assert.match(loader, /\.ts/);
  assert.match(loader, /\.tsx/);
});
