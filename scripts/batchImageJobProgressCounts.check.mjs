/**
 * 批量生图进度：成功张数 ≠ completedCount（后者含失败）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  return import('../src/utils/batchImageJobPoll.ts');
}

test('resolveBatchImageJobProgressCounts_失败不计入成功数', async () => {
  const { resolveBatchImageJobProgressCounts } = await load();
  const counts = resolveBatchImageJobProgressCounts({
    totalCount: 6,
    completedCount: 6,
    failedCount: 4,
    savedResults: [{ id: 'a' }, { id: 'b' }],
    items: [
      { stage: 'item_done' },
      { stage: 'item_done' },
      { stage: 'generate_fail' },
      { stage: 'rembg_fail' },
      { stage: 'generate_fail' },
      { stage: 'generate_fail' },
    ],
  });
  assert.equal(counts.successCount, 2);
  assert.equal(counts.failedCount, 4);
  assert.equal(counts.totalCount, 6);
});

test('resolveBatchImageJobProgressCounts_全成功时成功数等于总数', async () => {
  const { resolveBatchImageJobProgressCounts } = await load();
  const counts = resolveBatchImageJobProgressCounts({
    totalCount: 3,
    completedCount: 3,
    failedCount: 0,
    savedResults: [{ id: '1' }, { id: '2' }, { id: '3' }],
  });
  assert.equal(counts.successCount, 3);
  assert.equal(counts.failedCount, 0);
});

test('resolveBatchImageJobProgressCounts_优先result.effective', async () => {
  const { resolveBatchImageJobProgressCounts } = await load();
  const counts = resolveBatchImageJobProgressCounts({
    totalCount: 6,
    completedCount: 6,
    failedCount: 0,
    result: { scenes: { effective: 2 } },
  });
  assert.equal(counts.successCount, 2);
});
