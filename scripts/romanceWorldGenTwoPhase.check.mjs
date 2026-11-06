/**
 * 生成世界 · 两次串联契约：第1次基础设定，第2次人物/地点/事件/结局；禁止并行与假完成。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

function fiveNpcs() {
  const names = ['沈晚晴', '林夏', '顾清河', '周明远', '白晓棠'];
  return names.map((name, i) => ({
    id: `n${i + 1}`,
    name,
    gender: i % 2 === 0 ? '女' : '男',
    age: 22 + i,
    role: '关键角色',
    kind: 'roam',
    bio: '这是一段足够长的人物小传，用来通过软校验：人物须写出贴合世界观的简介与动机，不能只剩一句空话。',
  }));
}

function tenRooms() {
  const out = {};
  for (let i = 1; i <= 10; i += 1) {
    out[`room${i}`] = {
      name: `地点${i}`,
      desc: `地点${i}的场景描述，进入时可看见布局与氛围。`,
      exits: {},
    };
  }
  return out;
}

function fiveFixedEvents() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `fe${i + 1}`,
    name: `事件${i + 1}`,
    trigger: { kind: 'auto' },
    prompt: '这是一段超过二十字的固定事件场景提示词，包含冲突与可结算后果。',
    effects: [{ kind: 'stat', key: 'charm', delta: 1 }],
    nextIds: i < 4 ? [`fe${i + 2}`] : [],
  }));
}

test('worldGenTwoPhase_默认核心细项折叠为两次串联大类', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  assert.equal(gen.WORLD_GEN_PARALLEL_LIMIT, 1);
  assert.equal(gen.WORLD_GEN_NPCS_COUNT, 5);
  assert.equal(gen.WORLD_GEN_ROOMS_COUNT, 10);
  assert.equal(gen.isWorldGenTwoPhaseBatch(gen.WORLD_GEN_PHASE1_BATCH_ID), true);
  assert.equal(gen.isWorldGenTwoPhaseBatch(gen.WORLD_GEN_PHASE2_BATCH_ID), true);

  const ids = [...wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS];
  const batches = gen.resolveWorldGenBatches(ids);
  assert.deepEqual(
    batches.map((b) => b.id),
    [gen.WORLD_GEN_PHASE1_BATCH_ID, gen.WORLD_GEN_PHASE2_BATCH_ID],
  );
  const waves = gen.partitionWorldGenBatchWaves(batches.map((b) => b.id));
  assert.deepEqual(waves, [[gen.WORLD_GEN_PHASE1_BATCH_ID], [gen.WORLD_GEN_PHASE2_BATCH_ID]]);
  assert.equal(gen.worldGenBatchMaxTokens(batches[0].stepIds), 16000);
  assert.equal(gen.worldGenBatchMaxTokens(batches[1].stepIds), 16000);
});

test('worldGenTwoPhase_运行时严格两次请求且串行_缺日期本地兜底', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  const ids = [
    'prompt', 'hub:rules', 'hub:book', 'travelTime', 'creation', 'startResources', 'hub:paths',
    'npcs', 'rooms', 'fixedEvents', 'storylines',
  ];
  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '当代一线城市海边旅店继承与人情往来。',
    editorStepIds: ids,
    contentIds: wiz.contentIdsFromEditorSteps(ids),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  let calls = 0;
  let inflight = 0;
  let maxInflight = 0;
  const callOrder = [];

  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ids,
    completeFn: async (_cfg, messages) => {
      calls += 1;
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 30));
      inflight -= 1;
      const last = String(messages[messages.length - 1].content);
      if (last.includes('当前大类：「基础设定」')) {
        callOrder.push('phase1');
        return JSON.stringify({
          manifest: { description: '雾港旅店继承故事，人情与潮汐交织的当代海岸线。' },
          content: {
            prompt: {
              scriptTone: `${'你是雾港旅店叙事主持人。'.repeat(10)}保持口吻一致，推进人情与账本冲突。`,
            },
            worldRules: [{ id: 'wr1', name: '人情往来' }],
            gameRules: [{ id: 'gr1', name: '账本规则' }],
            worldBook: [{ id: 'wb1', title: '雾港潮汐', keywords: '潮汐', content: '海岸潮汐影响渔汛与客流。', enabled: true }],
            // 功能注释：故意漏 startDate，验证本地兜底，不得假失败
            travel: { apPerTurn: 10, advanceUnit: 'day', advanceDays: 1 },
            startMoney: 3000,
            moneyLabel: '元',
            customAttrs: [
              { id: 'insight', label: '洞察', desc: '察言观色', min: 0, max: 100, init: 40 },
              { id: 'charm', label: '魅力', desc: '待客手腕', min: 0, max: 100, init: 45 },
              { id: 'stamina', label: '体力', desc: '扛货熬夜', min: 0, max: 100, init: 50 },
            ],
            creation: { paths: [{ id: 'path-heir', name: '旅店继承人' }] },
          },
        });
      }
      if (last.includes('当前大类：「人物地点事件结局」')) {
        callOrder.push('phase2');
        return JSON.stringify({
          content: {
            npcs: fiveNpcs(),
            rooms: tenRooms(),
            startRoom: 'room1',
            locations: Object.keys(tenRooms()).map((id) => ({ id, name: tenRooms()[id].name })),
            fixedEvents: fiveFixedEvents(),
            storylines: [{
              id: 'main',
              name: '旅店主线',
              nodes: [{ id: 'n1', name: '接手旅店', desc: '熟悉账本与人情', conds: [] }],
            }],
            endings: [{ id: 'e1', title: '灯火长明' }, { id: 'e2', title: '远航离去' }],
          },
        });
      }
      throw new Error(`意外大类：${last.slice(0, 80)}`);
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.equal(calls, 2, '核心流程必须恰好两次请求');
  assert.deepEqual(callOrder, ['phase1', 'phase2']);
  assert.equal(maxInflight, 1, '两次必须串联，禁止并行');
  assert.equal(result.progress.doneCount, ids.length);
  assert.equal(result.progress.failedCount, 0);
  assert.match(String(result.mod.content.startDate || ''), /^\d{4}\.\d{2}\.\d{2}$/);
  assert.equal(result.mod.content.npcs.length, 5);
  assert.equal(Object.keys(result.mod.content.rooms || {}).length, 10);
  assert.equal(result.mod.content.fixedEvents.length, 5);
  assert.match(result.progress.label, /全部完成|成功/);
});

test('worldGenTwoPhase_人物地点条数不足须失败禁止假完成', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.match(
    gen.softValidateBatchPatch(['npcs'], { npcs: fiveNpcs().slice(0, 2) }) || '',
    /正好 5/,
  );
  assert.match(
    gen.softValidateBatchPatch(['rooms'], { rooms: { a: { name: 'A', desc: 'd' } } }) || '',
    /正好 10/,
  );
  assert.equal(gen.softValidateBatchPatch(['npcs'], { npcs: fiveNpcs() }), null);
  assert.equal(gen.softValidateBatchPatch(['rooms'], { rooms: tenRooms() }), null);
});

test('worldGenTwoPhase_源码门禁_串联与控制台调试输出', () => {
  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  const detail = readFileSync(join(romance, 'lib/worldGenProgressDetail.ts'), 'utf8');
  assert.match(src, /WORLD_GEN_PARALLEL_LIMIT\s*=\s*1/);
  assert.match(src, /WORLD_GEN_PHASE1_BATCH_ID|phase1Foundation/);
  assert.match(src, /WORLD_GEN_PHASE2_BATCH_ID|phase2WorldCast/);
  assert.match(src, /串联生成中/);
  assert.doesNotMatch(src, /并行生成中/);
  assert.match(src, /console\.log\(\s*["']\[world-gen\] request["']/);
  assert.match(src, /console\.log\(\s*["']\[world-gen\] response["']/);
  assert.match(src, /isWorldGenTwoPhaseBatch/);
  assert.match(detail, /WORLD_GEN_NPCS_COUNT\s*=\s*5/);
  assert.match(detail, /WORLD_GEN_ROOMS_COUNT\s*=\s*10/);
  assert.doesNotMatch(src, /fakeProgress|本地模板灌|mockTemplateFill/);
});
