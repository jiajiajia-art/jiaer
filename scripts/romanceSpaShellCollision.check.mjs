/**
 * 功能注释：主站 /funloom/romance/ 不得命中 Romance/index.html（Figma 壳）。
 * macOS 默认大小写不敏感，Romance/ 与路由 /romance/ 撞名会导致错壳 + 字体 404。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance');

test('Romance_禁止index.html以免与主站romance路由撞名', () => {
  assert.equal(existsSync(join(romance, 'index.html')), false, '不得存在 Romance/index.html');
  assert.ok(existsSync(join(romance, 'standalone.html')), '独立预览入口应为 standalone.html');
});

test('Romance_vite入口指向standalone', () => {
  const vite = readFileSync(join(romance, 'vite.config.ts'), 'utf8');
  const pkg = readFileSync(join(romance, 'package.json'), 'utf8');
  assert.match(vite, /standalone\.html/);
  assert.match(pkg, /standalone\.html/);
  assert.doesNotMatch(vite, /input:\s*path\.resolve\(__dirname,\s*'index\.html'\)/);
});

test('Romance_本地dist壳不得残留index以免污染title', () => {
  // 功能注释：构建产物应可删；若存在则至少不应再被主站 /romance/ 命中（由 shell guard + 无 index.html 保证）
  assert.equal(existsSync(join(romance, 'index.html')), false);
  const hostVite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  assert.match(hostVite, /romance-shell-guard|romanceShellGuard/);
});
