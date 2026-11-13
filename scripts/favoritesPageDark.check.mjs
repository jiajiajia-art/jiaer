/**
 * 收藏夹页对齐效果图：墨黑壳 + 白字返回标题，禁止浅色灰底
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Favorites_应对齐效果图墨黑壳与白字返回标题', () => {
  const css = read('src/page/Favorites.module.css');
  const tsx = read('src/page/Favorites.tsx');

  assert.match(css, /\.pageRoot\s*\{[\s\S]*?background:\s*(?:#000000|var\(--|color-mix\()/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?color:\s*(?:#ffffff|var\(--|color-mix\()/i);
  assert.match(css, /\.pageTitle\s*\{[\s\S]*?color:\s*(?:#ffffff|var\(--|color-mix\()/i);
  assert.match(css, /\.backButton\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.backButton\s*\{[\s\S]*?color:\s*(?:#ffffff|var\(--|color-mix\()/i);
  assert.match(css, /\.backButton svg\s*\{[\s\S]*?stroke:\s*currentColor/);
  assert.match(tsx, /styles\.pageHeader/);
  assert.match(tsx, /path d="M15 6L9 12L15 18"/);
  assert.doesNotMatch(tsx, /IoChevronBack/);
  assert.doesNotMatch(css, /\.pageTitle\s*\{[^}]*color:\s*#1a1a1a/i);
  assert.doesNotMatch(css, /\.mainContent\s*\{[^}]*color:\s*black/);
  assert.doesNotMatch(css, /\.backButton\s*\{[\s\S]*?background:\s*rgba\(0,\s*0,\s*0,\s*0\.06\)/);
});
