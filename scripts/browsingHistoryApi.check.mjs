/**
 * 前端浏览记录：走 /auth/games/history，仓库走 /warehouse
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('browsingHistory_调用服务端列表与清空', () => {
  const src = readFileSync(join(root, 'src/utils/browsingHistory.ts'), 'utf8');
  assert.match(src, /\/auth\/games\/history/);
  assert.match(src, /fetchBrowsingHistory/);
  assert.match(src, /api\.delete/);
});

test('warehouse_改走warehouse路径', () => {
  const src = readFileSync(join(root, 'src/api/home/getGameData.ts'), 'utf8');
  assert.match(src, /\/auth\/games\/warehouse/);
  assert.doesNotMatch(src, /getWareHouseData[\s\S]*\/auth\/games\/history/);
});

test('completeWithTools_平台透传tools', () => {
  const ai = readFileSync(join(root, 'Romance/src/lib/ai.ts'), 'utf8');
  const play = readFileSync(join(root, 'Romance/src/lib/platformPlayAi.ts'), 'utf8');
  assert.match(ai, /completePlayViaPlatform/);
  assert.match(ai, /tool_calls/);
  assert.doesNotMatch(ai, /平台文案链路暂不透传 tools/);
  assert.match(play, /tools\?\.length/);
  assert.match(play, /tool_calls/);
});
