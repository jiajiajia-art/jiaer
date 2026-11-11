/**
 * 详情「开始体验」须识别 ROMANCE 并跳转发布包进局，禁止未知类型 toast
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('GameDetail_ROMANCE归一化并跳转play进局', () => {
  const src = readFileSync(join(root, 'src/page/GameDetail.tsx'), 'utf8');
  assert.match(src, /normalizedEngine === 'ROMANCE'/);
  assert.match(src, /normalizedTags === 'ROMANCE'/);
  assert.match(src, /normalized === 'ROMANCE'/);
  assert.match(src, /\/romance\/\?play=1&fileId=/);
  assert.match(src, /normalizedGameMode === 'ROMANCE'/);
});
