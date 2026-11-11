/**
 * 完整作品生图编排：同 fileId 禁止并行双开，并发应复用同一 Promise
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('runIdeaFullWorkAssets_同fileId复用inflight_Promise', () => {
  const src = readFileSync(
    join(root, 'src/lib/galgame/runIdeaFullWorkAssets.ts'),
    'utf8',
  );
  assert.match(src, /inflightFullWorkByFileId/);
  assert.match(src, /joinedExisting:\s*true/);
  assert.match(src, /isIdeaFullWorkAssetsInflight/);
  assert.doesNotMatch(src, /素材生成已在进行中/);
});

test('runIdeaFullWorkAssets_轮询不等待board_settled提前退出', () => {
  const src = readFileSync(
    join(root, 'src/lib/galgame/runIdeaFullWorkAssets.ts'),
    'utf8',
  );
  assert.match(src, /boardSettledWithFailures:\s*false/);
  assert.doesNotMatch(src, /step === 'board_settled_retry'/);
});

test('useFileUpload_文本完成先标generating再updateJob', () => {
  const src = readFileSync(
    join(root, 'src/hooks/editor/useFileUpload.ts'),
    'utf8',
  );
  const genIdx = src.indexOf("markAssetGapBannerPending(completedData.fileId, 'generating')");
  const jobIdx = src.indexOf("updateJob(jobId, {\n                            fileId: completedData.fileId,\n                            status: 'completed'");
  assert.ok(genIdx > 0, '应标记 generating');
  assert.ok(jobIdx > 0, '应 updateJob completed');
  assert.ok(jobIdx > genIdx, 'generating 须在 updateJob(completed) 之前');
  assert.match(src, /joinedExisting/);
});

test('ideaFullWorkSession_banner变更会广播事件', () => {
  const src = readFileSync(
    join(root, 'src/lib/galgame/ideaFullWorkSession.ts'),
    'utf8',
  );
  assert.match(src, /ASSET_GAP_BANNER_EVENT/);
  assert.match(src, /dispatchEvent/);
});
