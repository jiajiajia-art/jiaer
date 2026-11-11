/**
 * 进游玩延迟：FE 单侧复用 gameDetail，禁止无谓再打 games/info
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('RouteReporter_有store详情时先复用再请求info', () => {
  const src = read('src/components/RouteReporter.tsx');
  assert.match(src, /clearPlayRuntime 瞬间为空时回退 gameDetail\.file_id/);
  assert.match(src, /storeFileId \|\| \(gameDetail\?\.file_id/);
  assert.match(src, /发起前再读一次 store/);
  assert.match(src, /latestDetail\.file_id === effectiveFileId/);
  assert.match(src, /getGameDetail\(\{ fileId: effectiveFileId \}\)/);
});

test('gameStore_clearPlayRuntime保留gameDetail', () => {
  const src = read('src/store/gameStore.ts');
  assert.match(src, /clearPlayRuntime/);
  assert.match(src, /保留 gameDetail/);
  const fn = src.slice(src.indexOf('clearPlayRuntime:'));
  const body = fn.slice(0, fn.indexOf('}),') + 2);
  assert.doesNotMatch(body, /gameDetail:\s*null/);
});

test('getGameDetail_inflight去重', () => {
  const src = read('src/api/home/getGameData.ts');
  assert.match(src, /dedupeInflight\(gameDetailInflight/);
  assert.match(src, /\/auth\/games\/info/);
});
