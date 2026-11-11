/**
 * 详细设定缺 detail 时，预览不得 reading 'trim'。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../Romance/src/game/loreContext.ts'), 'utf8');

test('loreContext_缺detail不得直接trim', () => {
  assert.match(src, /const loreText = \(raw: unknown\) => asTrimmedString\(raw\)/);
  assert.match(src, /loreText\(r\.detail\)/);
  assert.match(src, /loreText\(f\.detail\)/);
  assert.match(src, /loreText\(c\.detail\)/);
  assert.doesNotMatch(src, /\.detail\.trim\(/);
  assert.doesNotMatch(src, /\.brief\.trim\(/);
  assert.doesNotMatch(src, /k\.trim\(\)/);
});
