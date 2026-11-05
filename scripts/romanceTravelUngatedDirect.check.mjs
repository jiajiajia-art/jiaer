/**
 * 地点未配通行/解锁门槛时：无邻接路径也可直达；
 * 「还不知道怎么去」不得再作为无门槛地点的默认拦截文案。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('travelPlan_无邻接时未配门槛可直达_有门槛才拦截', () => {
  const mud = read('Romance/src/game/mud.ts');
  assert.match(mud, /export function allowDirectTravel/);
  assert.match(mud, /const gate = allowDirectTravel\(s, to\)/);
  // 功能注释：迷雾文案不得再作为 BFS 失败后的无条件 return reason
  assert.doesNotMatch(
    mud,
    /return \{ \.\.\.base, reachable: false, reason: "你还不知道怎么去那里/,
  );
  // 功能注释：无路径时按门槛决定；通过则 hops:1 直达
  const fnStart = mud.indexOf('export function travelPlan');
  assert.ok(fnStart >= 0);
  const fn = mud.slice(fnStart, mud.indexOf('export type RoomStatusKind', fnStart));
  assert.match(fn, /allowDirectTravel/);
  assert.match(fn, /hops: 1/);
  assert.match(fn, /if \(!gate\.ok\) return \{ \.\.\.base, reachable: false, reason: gate\.note \}/);
});

test('allowDirectTravel_委托 roomAccess_未满足才不可达', () => {
  const mud = read('Romance/src/game/mud.ts');
  const start = mud.indexOf('export function allowDirectTravel');
  assert.ok(start >= 0);
  const end = mud.indexOf('export function travelPlan', start);
  const block = mud.slice(start, end);
  assert.match(block, /roomAccess\(s, roomId\)/);
  assert.match(block, /if \(!acc\.ok\)/);
  assert.match(block, /暂时无法前往/);
  assert.match(block, /return \{ ok: true, note: "" \}/);
});
