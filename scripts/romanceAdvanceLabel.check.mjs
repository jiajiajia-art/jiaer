/**
 * 底栏中央主行动钮：养成开默认「日程」；养成关改「推进」并直接推进时间。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('romanceAdvanceLabel_养成开日程_养成关推进', () => {
  const chrome = readFileSync(join(romance, 'components/MudChrome.tsx'), 'utf8');
  const live = readFileSync(join(romance, 'mods/live.ts'), 'utf8');
  const ent = readFileSync(join(romance, 'mods/ent/index.ts'), 'utf8');
  const tour = readFileSync(join(romance, 'components/GameTour.tsx'), 'utf8');
  const registry = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');

  assert.match(chrome, /worldGrowEnabled/);
  assert.match(chrome, /growOn \? "日程" : "推进"/);
  assert.match(chrome, /term\(\s*["']advance["']\s*,\s*growOn \? "日程" : "推进"\s*\)/);
  assert.match(chrome, /else advanceNow\(\)/);
  assert.match(live, /advance:\s*["']日程["']/);
  assert.match(ent, /advance:\s*["']日程["']/);
  assert.match(tour, /id:\s*["']advance["'][\s\S]{0,80}title:\s*["']日程["']/);
  assert.match(registry, /return fromTerms \|\| "推进"/);
});
