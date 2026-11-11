/**
 * 术语解析不得与 liveTerm/termReader 互相递归（曾导致 Maximum call stack size exceeded）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('resolveLiveTerm_禁止回调liveTerm以免爆栈', () => {
  const reg = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');
  const live = readFileSync(join(romance, 'mods/live.ts'), 'utf8');
  const body = reg.slice(reg.indexOf('function resolveLiveTerm'));
  const end = body.search(/\nexport const term/);
  const fn = end > 0 ? body.slice(0, end) : body;
  assert.doesNotMatch(fn, /\bliveTerm\s*\(/);
  assert.match(fn, /termFallback\s*\(/);
  assert.match(live, /export function termFallback/);
  assert.match(reg, /setTermReader\(\(k\) => resolveLiveTerm/);
});
