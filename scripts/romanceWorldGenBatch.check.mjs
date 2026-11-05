/**
 * 生成世界 · 大类合并：同类细项一次请求，进度按大类，不为刷进度多打接口。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenBatch_人物线路人物人脉同属人物与线路_关系玩法归已添加的玩法', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const charBatches = gen.resolveWorldGenBatches(['hub:paths', 'npcs', 'contacts']);
  assert.equal(charBatches.length, 1);
  assert.equal(charBatches[0].id, 'characters');
  assert.equal(charBatches[0].name, '人物与线路');
  assert.deepEqual([...charBatches[0].stepIds].sort(), ['contacts', 'hub:paths', 'npcs']);
  const mixed = gen.resolveWorldGenBatches(['hub:paths', 'npcs', 'relations', 'contacts']);
  assert.equal(mixed.length, 2);
  assert.deepEqual(mixed.map((b) => b.id).sort(), ['characters', 'playMods']);
  const play = mixed.find((b) => b.id === 'playMods');
  assert.deepEqual([...play.stepIds], ['relations']);
});

test('worldGenBatch_世界规则时间与推进建角须分列大类', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const batches = gen.resolveWorldGenBatches([
    'prompt',
    'hub:rules',
    'hub:book',
    'travelTime',
    'creation',
    'startResources',
  ]);
  assert.deepEqual(
    batches.map((b) => b.name),
    ['世界规则', '时间与推进', '建角'],
  );
  assert.equal(gen.worldGenBatchMaxTokens(['hub:paths', 'npcs']), 12000);
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
  assert.ok(batchCount < progress.total, '大类批次数须少于细项数（同类合并）');
  assert.ok(progress.modules.some((m) => m.id === 'hub:paths' || m.name === '人物线路'));
  assert.ok(progress.modules.some((m) => m.id === 'hub:rules'));
  assert.ok(progress.modules.some((m) => m.id === 'travelTime' || m.name === '时间与推进'));
  assert.ok(!progress.modules.some((m) => m.id === 'opening'), '开场剧情默认不进生成进度');
  const counts = gen.worldGenBatchProgressCounts(progress.modules);
  assert.equal(counts.total, batchCount);
  assert.equal(counts.finished, 0);
});

test('worldGenBatch_源码与向导禁止按细项刷并行请求', () => {
  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(src, /resolveWorldGenBatches|generateWorldGenBatch/);
  assert.match(src, /同类|大类/);
  assert.doesNotMatch(src, /WORLD_GEN_PARALLEL_LIMIT\s*=\s*[6789]/);
  assert.match(wiz, /按合并请求（大类）完成速度估算|合并请求/);
});
