/**
 * 任务 SSE：已有 type=error 时不得再标 INVALID_JSON
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/api/galgame/questsStream.ts'), 'utf8');
const galgame = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');

test('questsStream_有SSE_error时不二次INVALID_JSON', () => {
  assert.match(src, /let streamError/);
  assert.match(src, /if \(!streamError\)/);
  assert.match(src, /handlers\.onError\?\.\('INVALID_JSON'\)/);
});

test('Galgame_锁忙文案映射panelAttrsBusy', () => {
  assert.match(galgame, /Failed to acquire lock/i);
  assert.match(galgame, /panelAttrsBusy/);
  assert.match(galgame, /PERSIST_FAILED/);
});
