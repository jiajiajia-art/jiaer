/**
 * Romance 嵌入 funloom：同端口路由契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('App_应懒加载RomanceHost并挂romance路由', () => {
  const app = read('src/App.tsx');
  assert.match(app, /lazy\(\(\) => import\('\.\/page\/RomanceHost'\)\)/);
  assert.match(app, /path="\/romance\/\*"/);
  assert.match(app, /<RomanceHost\s*\/>/);
});

test('RomanceHost_应经virtual模块嵌入并清理html主题class', () => {
  const host = read('src/page/RomanceHost.tsx');
  assert.match(host, /virtual:romance-app/);
  assert.match(host, /virtual:romance-css/);
  assert.match(host, /clearRomanceHtmlClasses|data-romance/);
});

test('Worker_应将短链romance重定向到funloomromance', () => {
  const worker = read('src/index.js');
  assert.match(worker, /path === '\/romance'/);
  assert.match(worker, /\/funloom\/romance/);
});

test('vite_应启用tailwind与romance_virtual模块', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /@tailwindcss\/vite/);
  assert.match(vite, /romance-virtual-modules|romanceVirtualModules/);
  assert.match(vite, /romance-short-link-redirect|romanceShortLinkRedirect/);
});

test('Romance_css_嵌入时不应引入tailwind_preflight整包', () => {
  const css = read('Romance/src/index.css');
  assert.doesNotMatch(css, /@import\s+['"]tailwindcss['"]\s*;/);
  assert.match(css, /tailwindcss\/utilities/);
});
