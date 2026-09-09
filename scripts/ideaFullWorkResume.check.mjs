/**
 * 完整作品生图续跑：切侧栏不得重开批量；失败不自动重生成
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

async function loadResume() {
  return import('../src/lib/galgame/ideaFullWorkResume.ts');
}

test('shouldResumeIdeaFullWorkOrchestration_仅pending自动开跑', async () => {
  const { shouldResumeIdeaFullWorkOrchestration } = await loadResume();
  assert.equal(
    shouldResumeIdeaFullWorkOrchestration({ hasFlags: true, inflight: false, status: 'pending' }),
    true,
  );
  assert.equal(
    shouldResumeIdeaFullWorkOrchestration({ hasFlags: true, inflight: true, status: 'pending' }),
    false,
  );
  assert.equal(
    shouldResumeIdeaFullWorkOrchestration({ hasFlags: true, inflight: false, status: 'running' }),
    false,
  );
  assert.equal(
    shouldResumeIdeaFullWorkOrchestration({ hasFlags: true, inflight: false, status: 'failed' }),
    false,
  );
  assert.equal(
    shouldResumeIdeaFullWorkOrchestration({ hasFlags: true, inflight: false, status: 'done' }),
    false,
  );
  assert.equal(
    shouldResumeIdeaFullWorkOrchestration({ hasFlags: false, inflight: false, status: 'pending' }),
    false,
  );
});

test('resolveIdeaAssetPhaseAction_已完成或失败不新开_有jobId则只轮询', async () => {
  const { resolveIdeaAssetPhaseAction } = await loadResume();
  assert.equal(resolveIdeaAssetPhaseAction(false, { state: 'pending' }), 'skip');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'done' }), 'skip');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'failed', jobId: 'j1' }), 'skip');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'skipped' }), 'skip');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'active', jobId: 'job-a' }), 'poll');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'pending', jobId: 'job-a' }), 'poll');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'pending' }), 'start');
  assert.equal(resolveIdeaAssetPhaseAction(true, { state: 'active' }), 'start');
});

test('GameSettingsEditor_续跑不得把failed当自动重开', () => {
  const src = read('src/page/GameSettingsEditor.tsx');
  assert.match(src, /shouldResumeIdeaFullWorkOrchestration/);
  assert.doesNotMatch(src, /status !== 'pending' && status !== 'failed'/);
  assert.doesNotMatch(src, /handlePanelChange[\s\S]{0,200}runIdeaFullWorkAssets/);
});

test('runIdeaFullWorkAssets_应按阶段skip或poll禁止盲目start', () => {
  const src = read('src/lib/galgame/runIdeaFullWorkAssets.ts');
  assert.match(src, /resolveIdeaAssetPhaseAction/);
  assert.match(src, /action === 'poll'/);
  assert.match(src, /jobId/);
});
