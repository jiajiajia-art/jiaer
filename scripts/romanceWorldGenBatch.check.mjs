/**
 * 生成世界 · 两次串联大类：同类细项一次请求，进度按细项，禁止并行刷接口。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenBatch_线路进第一次_人物地点事件进第二次_关系玩法独立', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const core = gen.resolveWorldGenBatches(['hub:paths', 'npcs', 'contacts']);
  assert.deepEqual(core.map((b) => b.id).sort(), [
    gen.WORLD_GEN_PHASE1_BATCH_ID,
    gen.WORLD_GEN_PHASE2_BATCH_ID,
    'contacts',
  ].sort());
  const mixed = gen.resolveWorldGenBatches(['hub:paths', 'npcs', 'relations', 'contacts']);
  assert.ok(mixed.some((b) => b.id === 'playMods'));
  const play = mixed.find((b) => b.id === 'playMods');
  assert.deepEqual([...play.stepIds], ['relations']);
});

test('worldGenBatch_基础设定与人物地点事件结局两大类', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const batches = gen.resolveWorldGenBatches([
    'prompt',
    'hub:rules',
    'hub:book',
    'travelTime',
    'creation',
    'startResources',
  ]);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].id, gen.WORLD_GEN_PHASE1_BATCH_ID);
  assert.equal(batches[0].name, '基础设定');
  assert.equal(gen.worldGenBatchMaxTokens(['hub:paths', 'npcs', 'rooms', 'fixedEvents']), 16000);
  assert.equal(gen.worldGenBatchMaxTokens(['travelTime']), 4000);
});

test('worldGenBatch_全部编辑器细项须有大类归属', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const allIds = wiz.ALL_WORLD_GEN_EDITOR_STEP_IDS;
  const covered = new Set(gen.WORLD_GEN_BATCH_CATEGORIES.flatMap((c) => c.stepIds));
  const missing = allIds.filter((id) => !covered.has(id));
  assert.deepEqual(missing, [], `未归类细项: ${missing.join(',')}`);
  const progress = gen.makeInitialProgress(wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS);
  assert.equal(progress.total, wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length, '进度行按勾选细项展示');
  assert.ok(progress.modules.every((m) => m.batchId), '细项须挂 batchId 以便合并请求');
  const batchCount = new Set(progress.modules.map((m) => m.batchId)).size;
  assert.equal(batchCount, 2, '默认核心应只有两次串联大类');
  assert.ok(progress.modules.some((m) => m.id === 'hub:paths' || m.name === '人物线路'));
  assert.ok(progress.modules.some((m) => m.id === 'hub:rules'));
  assert.ok(progress.modules.some((m) => m.id === 'travelTime' || m.name === '时间与推进'));
  assert.ok(!progress.modules.some((m) => m.id === 'opening'), '开场剧情默认不进生成进度');
  const counts = gen.worldGenBatchProgressCounts(progress.modules);
  assert.equal(counts.total, batchCount);
  assert.equal(counts.finished, 0);
});

test('worldGenBatch_源码与向导禁止并行且走两次串联', () => {
  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(src, /resolveWorldGenBatches|generateWorldGenBatch/);
  assert.match(src, /phase1Foundation|phase2WorldCast|两次串联/);
  assert.match(src, /WORLD_GEN_PARALLEL_LIMIT\s*=\s*1/);
  assert.doesNotMatch(src, /WORLD_GEN_PARALLEL_LIMIT\s*=\s*[23456789]/);
  assert.match(wiz, /按合并请求（大类）完成速度估算|合并请求/);
});
