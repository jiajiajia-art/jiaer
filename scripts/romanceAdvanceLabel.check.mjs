/**
 * 底栏中央主行动钮默认文案为「日程」（打开本周日程板），禁止回退为「推进」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('romanceAdvanceLabel_底栏中央钮默认日程', () => {
  const chrome = readFileSync(join(romance, 'components/MudChrome.tsx'), 'utf8');
  const live = readFileSync(join(romance, 'mods/live.ts'), 'utf8');
  const ent = readFileSync(join(romance, 'mods/ent/index.ts'), 'utf8');
  const tour = readFileSync(join(romance, 'components/GameTour.tsx'), 'utf8');

  assert.match(chrome, /term\(\s*["']advance["']\s*,\s*["']日程["']\s*\)/);
  assert.doesNotMatch(chrome, /term\(\s*["']advance["']\s*,\s*["']推进["']\s*\)/);
  assert.match(live, /advance:\s*["']日程["']/);
  assert.match(ent, /advance:\s*["']日程["']/);
  assert.match(tour, /id:\s*["']advance["'][\s\S]{0,80}title:\s*["']日程["']/);
});
