/**
 * 场景预载：当前+下一张优先，其余顺序
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScenePreloadPlan,
  drainLeadingSceneChanges,
  SceneImagePreloadScheduler,
  uniquePreserveOrder,
} from '../src/lib/galgame/sceneImagePreload.ts';

test('uniquePreserveOrder_去重保序', () => {
  assert.deepEqual(uniquePreserveOrder(['a', 'b', 'a', '', null, 'c']), ['a', 'b', 'c']);
});

test('buildScenePreloadPlan_默认不开全表rest', () => {
  const plan = buildScenePreloadPlan({
    sceneUrlsInOrder: ['s1', 's2', 's3', 's4'],
    currentUrl: 's2',
    nextUrl: 's3',
  });
  assert.deepEqual(plan.priority, ['s2', 's3']);
  assert.deepEqual(plan.rest, []);
});

test('buildScenePreloadPlan_显式includeCatalogRest才扫其余', () => {
  const plan = buildScenePreloadPlan({
    sceneUrlsInOrder: ['s1', 's2', 's3', 's4'],
    currentUrl: 's2',
    nextUrl: 's3',
    includeCatalogRest: true,
  });
  assert.deepEqual(plan.priority, ['s2', 's3']);
  assert.deepEqual(plan.rest, ['s1', 's4']);
});

test('buildScenePreloadPlan_无显式next时取列表下一张', () => {
  const plan = buildScenePreloadPlan({
    sceneUrlsInOrder: ['s1', 's2', 's3'],
    currentUrl: 's1',
  });
  assert.deepEqual(plan.priority, ['s1', 's2']);
  assert.deepEqual(plan.rest, []);
});

test('drainLeadingSceneChanges_合并连续换景', () => {
  const drained = drainLeadingSceneChanges(
    { type: 'scene_change', sceneId: 'a' },
    [
      { type: 'scene_change', sceneId: 'b' },
      { type: 'scene_change', sceneId: 'c' },
      { type: 'dialogue', sceneId: 'x' },
    ],
  );
  assert.equal(drained?.finalStep.sceneId, 'c');
  assert.equal(drained?.skipQueueCount, 2);
});

test('SceneImagePreloadScheduler_先并行优先再串行其余', async () => {
  const order = [];
  const scheduler = new SceneImagePreloadScheduler({
    loader: async (url) => {
      order.push(`start:${url}`);
      await new Promise((r) => setTimeout(r, url === 'p1' ? 20 : 5));
      order.push(`done:${url}`);
    },
  });

  await scheduler.applyPlan({
    priority: ['p1', 'p2'],
    rest: ['r1', 'r2'],
  });
  // 等 rest 泵完
  await new Promise((r) => setTimeout(r, 80));

  const doneIdx = (u) => order.indexOf(`done:${u}`);
  assert.ok(doneIdx('p1') >= 0 && doneIdx('p2') >= 0);
  assert.ok(Math.max(doneIdx('p1'), doneIdx('p2')) < doneIdx('r1'));
  assert.ok(doneIdx('r1') < doneIdx('r2'));
});
