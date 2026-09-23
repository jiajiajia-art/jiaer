/**
 * 完整作品生图进度百分比 / 阶段快照
 */
import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  return import('../src/lib/galgame/ideaFullWorkProgress.ts');
}

test('computeIdeaAssetPercent_均分权重按完成张数推进', async () => {
  const { computeIdeaAssetPercent } = await load();
  const percent = computeIdeaAssetPercent({
    phase: 'portraits',
    flags: { portraits: true, scenes: true, cover: false },
    portraits: { state: 'active', completed: 3, total: 6 },
    scenes: { state: 'pending', completed: 0, total: 0 },
    cover: { state: 'skipped', completed: 0, total: 0 },
  });
  // 两阶段各 50%；立绘完成一半 → 25
  assert.equal(percent, 25);
});

test('computeIdeaAssetPercent_阶段完成计入满权重', async () => {
  const { computeIdeaAssetPercent } = await load();
  const percent = computeIdeaAssetPercent({
    phase: 'scenes',
    flags: { portraits: true, scenes: true, cover: false },
    portraits: { state: 'done', completed: 6, total: 6 },
    scenes: { state: 'active', completed: 0, total: 6 },
    cover: { state: 'skipped', completed: 0, total: 0 },
  });
  assert.equal(percent, 50);
});

test('createInitialIdeaAssetProgress_未勾选阶段为skipped', async () => {
  const { createInitialIdeaAssetProgress } = await load();
  const snap = createInitialIdeaAssetProgress('f1', {
    portraits: true,
    scenes: false,
    cover: true,
  });
  assert.equal(snap.portraits.state, 'pending');
  assert.equal(snap.scenes.state, 'skipped');
  assert.equal(snap.cover.state, 'pending');
  assert.equal(snap.cover.total, 1);
});

test('mergeAssetProgressRowWithLiveCounts_pending场景缺口不算失败', async () => {
  const { mergeAssetProgressRowWithLiveCounts } = await load();
  const live = {
    portraitsPresent: 1,
    portraitsTotal: 5,
    scenesPresent: 0,
    scenesTotal: 6,
    coverPresent: false,
  };
  const merged = mergeAssetProgressRowWithLiveCounts(
    'scenes',
    { state: 'pending', completed: 0, total: 0, failed: 0 },
    live,
  );
  assert.equal(merged?.state, 'pending');
  assert.equal(merged?.total, 6);
  assert.equal(merged?.completed, 0);
  assert.equal(merged?.failed, 0);
});

test('mergeAssetProgressRowWithLiveCounts_结束后缺图回填失败', async () => {
  const { mergeAssetProgressRowWithLiveCounts } = await load();
  const live = {
    portraitsPresent: 4,
    portraitsTotal: 5,
    scenesPresent: 0,
    scenesTotal: 6,
    coverPresent: false,
  };
  const merged = mergeAssetProgressRowWithLiveCounts(
    'portraits',
    { state: 'done', completed: 4, total: 5, failed: 1 },
    live,
  );
  assert.equal(merged?.state, 'failed');
  assert.equal(merged?.failed, 1);
  assert.equal(merged?.completed, 4);
});
