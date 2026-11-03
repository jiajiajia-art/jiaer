/**
 * 生成世界 · 分模组真实 AI 管线契约：只生成勾选项、失败可重试、禁止假进度灌数。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenGenerate_extract与merge_以及只跑勾选模组', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  const patch = gen.extractContentPatch('说明文字\n```json\n{"content":{"npcs":[{"id":"a","name":"阿宁"}]}}\n```');
  assert.equal(patch.npcs[0].name, '阿宁');
  const repaired = gen.extractContentPatch(
    '{"content":{"fixedEvents":[{"id":"arrival","name":"抵达"} {"id":"storm","name":"暴雨"},]}}',
  );
  assert.deepEqual(
    repaired.fixedEvents.map((event) => event.id),
    ['arrival', 'storm'],
    '固定事件数组漏逗号和尾逗号时应安全修复',
  );
  assert.throws(
    () => gen.extractContentPatch('{"content":{"fixedEvents":[{"id":"half"'),
    /JSON|对象/,
    '截断 JSON 不得伪装成成功结果',
  );
  assert.equal(gen.worldGenModuleMaxTokens('fixedEvents'), 8000);
  assert.equal(gen.worldGenModuleMaxTokens('storylines'), 8000);
  assert.equal(gen.worldGenModuleMaxTokens('rooms'), 4000);
  assert.match(
    gen.formatGenError(new SyntaxError("Expected ',' or ']' after array element in JSON at position 88")),
    /JSON 不完整/,
  );
  assert.equal(
    gen.shortGenError(new SyntaxError("Expected ',' or ']' after array element in JSON at position 88")),
    'JSON 不完整',
  );
  assert.equal(gen.shortGenError(new Error('校验失败：缺 name')), '字段校验未通过');

  // 功能注释：时间与推进须带合法开局日期；开场白至少两段
  assert.equal(
    gen.sanitizeWorldGenBatchPatch(['travelTime'], { startDate: '2019-9-1', travel: { apPerTurn: 10 } }).startDate,
    '2019.09.01',
  );
  assert.equal(
    gen.sanitizeWorldGenBatchPatch(['travelTime'], { startDate: '2024年3月15日', travel: { apPerTurn: 10 } }).startDate,
    '2024.03.15',
  );
  assert.equal(
    gen.sanitizeWorldGenBatchPatch(['travelTime'], {
      travel: { startDate: '1935-3-12', apPerTurn: 8 },
    }).startDate,
    '1935.03.12',
  );
  assert.match(
    gen.softValidateBatchPatch(['travelTime'], { travel: { apPerTurn: 10 } }) || '',
    /开局日期/,
  );
  assert.equal(
    gen.softValidateBatchPatch(['travelTime'], { startDate: '2019.09.01', travel: { apPerTurn: 10 } }),
    null,
  );
  // 功能注释：AI 漏写 startDate 时按题材补全，软校验前不得再因缺日期失败
  const ensuredModern = gen.ensureWorldGenTravelTimeStartDate(
    { travel: { apPerTurn: 10 } },
    { title: '都市恋曲', setting: '当代一线城市白领恋爱。' },
  );
  assert.match(ensuredModern.startDate, /^\d{4}\.\d{2}\.\d{2}$/);
  assert.equal(ensuredModern.startDate.slice(0, 4), '2024');
  const ensuredEra = gen.inferWorldGenStartDate({ title: '乱世', setting: '民国上海滩的报馆与舞厅。' });
  assert.equal(ensuredEra.slice(0, 4), '1935');
  assert.equal(
    gen.softValidateBatchPatch(['travelTime'], ensuredModern),
    null,
  );
  assert.match(
    gen.softValidateBatchPatch(['opening'], { opening: { title: '序章' } }) || '',
    /开场白/,
  );
  assert.equal(
    gen.softValidateBatchPatch(['opening'], {
      opening: {
        paragraphs: [
          '清晨的雾还没散尽，门铃忽然响了两下。你推开旅店木门，海风带着咸味灌进来，楼道里的旧灯晃了一下，像是在提醒你：从今天起，这里的客人、账本和风雨都要归你接手了。',
          '柜台上的记账本翻到新的一页，阿宁抬眼看你，声线不紧不慢：「钥匙在抽屉第二层。先把名字写上——别急着答应谁，先把自己安顿好。」窗外潮声一阵一阵，像给这开场打着节拍。',
        ],
      },
    }),
    null,
  );

  const merged = gen.mergeModContent(
    { prompt: { worldIntro: '旧' }, npcs: [{ id: 'a', name: '旧名' }] },
    { npcs: [{ id: 'a', name: '阿宁', role: '店员' }], rooms: { start: { name: '旅店', desc: '', exits: {} } } },
  );
  assert.equal(merged.prompt.worldIntro, '旧');
  assert.equal(merged.npcs[0].name, '阿宁');
  assert.equal(merged.npcs[0].role, '店员');
  assert.equal(merged.rooms.start.name, '旅店');

  const calls = [];
  const completeFn = async (_cfg, messages) => {
    calls.push(messages.map((m) => m.content).join('\n'));
    const last = String(messages[messages.length - 1].content);
    // 功能注释：瘦身提示含「人物/地点」字样，只能用当前大类标题分流
    if (last.includes('当前大类：「人物与线路」')) {
      return JSON.stringify({
        content: {
          npcs: [{
            id: 'n1',
            name: '阿宁',
            role: '店主',
            kind: 'staff',
            home: 'start',
            roam: [],
            bio: '阿宁是雾港海边旅店的店主，性格温柔，擅长照顾客人并记住每位常客的口味与心事。她从小在码头长大，熟悉潮汐与渔汛，也懂得在风雨夜里把灯火留得更亮一些。面对继承旅店的玩家，她既像邻家姐姐又像可靠搭档，会用平静的语气提醒账本、库存与人情往来，绝不越界替玩家做决定。',
            gender: '女',
            age: 28,
          }],
        },
      });
    }
    if (last.includes('当前大类：「地点」')) {
      return JSON.stringify({ content: { rooms: { start: { name: '雾港旅店', desc: '靠海', exits: {} } }, startRoom: 'start' } });
    }
    throw new Error(`意外模组提示: ${last.slice(0, 80)}`);
  };

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    editorStepIds: ['npcs', 'rooms'],
    contentIds: wiz.contentIdsFromEditorSteps(['npcs', 'rooms']),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ['npcs', 'rooms'],
    completeFn,
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  // 功能注释：人物大类含补长文可能 2 次，地点 1 次；合计 ≤3，且绝不是按细项各打一次的 2 以上无合并
  assert.ok(calls.length >= 2 && calls.length <= 3, `人物+地点合并后应为 2~3 次请求，实际 ${calls.length}`);
  assert.equal(result.progress.doneCount, 2);
  assert.equal(result.progress.failedCount, 0);
  assert.deepEqual(
    result.progress.modules.map((m) => m.id).sort(),
    ['npcs', 'rooms'],
    '进度按勾选细项展示，便于显示正在写什么',
  );
  assert.ok(result.progress.modules.every((m) => m.batchId));
  assert.equal(result.mod.content.npcs[0].name, '阿宁');
  assert.equal(result.mod.content.rooms.start.name, '雾港旅店');
  // 未勾选的结局等不得被擅自写入
  assert.equal(result.mod.content.endings, undefined);
});

test('worldGenGenerate_AI失败须标记且不灌假内容', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    editorStepIds: ['npcs'],
    contentIds: ['characters'],
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ['npcs'],
    completeFn: async () => {
      throw Object.assign(new Error('请求失败（500）'), { status: 500, body: '{"error":{"message":"boom"}}' });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.equal(result.progress.failedCount, 1);
  assert.equal(result.progress.modules[0].id, 'npcs');
  assert.match(result.progress.modules[0].name, /人物/);
  assert.equal(result.progress.modules[0].status, 'failed');
  assert.match(result.progress.modules[0].error || '', /服务暂时异常|失败|boom|500/);
  assert.equal(result.mod.content.npcs, undefined);
});

test('worldGenGenerate_鉴权失败须立刻停批且不打下一波', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  // 世界规则在第 1 波，地点/人物与线路在后续波；第 1 波鉴权失败后不得进入下一波
  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    editorStepIds: ['prompt', 'npcs', 'rooms'],
    contentIds: wiz.contentIdsFromEditorSteps(['prompt', 'npcs', 'rooms']),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  let calls = 0;
  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ['prompt', 'npcs', 'rooms'],
    completeFn: async () => {
      calls += 1;
      throw Object.assign(new Error('请求失败（401）'), {
        status: 401,
        body: '{"error":{"message":"Authentication Fails, Your api key: **** is invalid"}}',
      });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'bad', model: 'm' },
  });

  assert.equal(calls, 1, '鉴权失败时禁止进入下一波大类');
  assert.equal(result.progress.stoppedByAuth, true);
  assert.equal(result.progress.failedCount, 3);
  assert.equal(result.progress.doneCount, 0);
  assert.match(result.progress.label, /停止/);
  assert.match(result.progress.modules.find((m) => m.id === 'prompt')?.error || '', /登录|平台/);
  assert.match(result.progress.modules.find((m) => m.id === 'npcs')?.error || '', /未继续请求/);
  assert.equal(gen.isFatalAuthGenError({ status: 401, body: '{}' }), true);
  assert.equal(gen.isFatalAuthGenError({ status: 500, body: '{"error":{"message":"boom"}}' }), false);
  assert.equal(gen.progressHasAuthFailure(result.progress), true);
});

test('worldGenGenerate_同类须并成一次请求且进度按大类', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  const waves = gen.partitionWorldGenBatchWaves(
    gen.resolveWorldGenBatches(['prompt', 'npcs', 'rooms', 'fixedEvents', 'gigs']).map((b) => b.id),
  );
  assert.ok(waves[0].includes('worldRules'));
  assert.ok(waves[1].includes('rooms'));
  assert.ok(waves[2].includes('characters'));
  // 功能注释：时间与推进在人物之后，便于对齐年龄；未勾选时本断言用 fixedEvents 位次
  assert.ok(waves[3].includes('fixedEvents'));
  assert.ok(waves.some((w) => w.includes('playMods')), '扩展大类落入末波');

  const wavesWithTravel = gen.partitionWorldGenBatchWaves(
    gen.resolveWorldGenBatches(['prompt', 'npcs', 'travelTime', 'fixedEvents']).map((b) => b.id),
  );
  const travelWaveIdx = wavesWithTravel.findIndex((w) => w.includes('travelTime'));
  const charWaveIdx = wavesWithTravel.findIndex((w) => w.includes('characters'));
  const worldWaveIdx = wavesWithTravel.findIndex((w) => w.includes('worldRules'));
  assert.ok(travelWaveIdx > worldWaveIdx, '时间与推进须在世界规则之后');
  assert.ok(travelWaveIdx > charWaveIdx, '时间与推进须在人物与线路之后，以便对齐年龄');

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    editorStepIds: ['npcs', 'rooms', 'relations', 'hub:paths'],
    contentIds: wiz.contentIdsFromEditorSteps(['npcs', 'rooms', 'relations', 'hub:paths']),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  let calls = 0;
  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ['npcs', 'rooms', 'relations', 'hub:paths'],
    completeFn: async (_cfg, messages) => {
      calls += 1;
      const last = String(messages[messages.length - 1].content);
      if (last.includes('当前大类：「人物与线路」')) {
        return JSON.stringify({
          content: {
            npcs: [{
              id: 'n1',
              name: '阿宁',
              gender: '女',
              age: 28,
              bio: '阿宁是雾港海边旅店的店主，性格温柔，擅长照顾客人并记住每位常客的口味与心事。她从小在码头长大，熟悉潮汐与渔汛，也懂得在风雨夜里把灯火留得更亮一些。面对继承旅店的玩家，她既像邻家姐姐又像可靠搭档，会用平静的语气提醒账本、库存与人情往来，绝不越界替玩家做决定。',
            }],
            relations: { confessThreshold: 60 },
            creation: { paths: [{ id: 'p1', name: '旅店继承人' }] },
          },
        });
      }
      if (last.includes('当前大类：「地点」')) {
        return JSON.stringify({ content: { rooms: { start: { name: '旅店', desc: '', exits: {} } } } });
      }
      throw new Error(`意外大类提示: ${last.slice(0, 80)}`);
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.ok(calls >= 2 && calls <= 3, `人物线路/人物/关系须并成一大类（可含补文），加地点共 2~3 次，实际 ${calls}`);
  assert.equal(result.progress.doneCount, 4, '进度按细项：paths/npcs/relations/rooms');
  assert.deepEqual(
    result.progress.modules.map((m) => m.id).sort(),
    ['hub:paths', 'npcs', 'relations', 'rooms'].sort(),
  );
  assert.equal(result.mod.content.npcs[0].name, '阿宁');
  assert.equal(result.mod.content.rooms.start.name, '旅店');
  assert.equal(result.mod.content.relations.confessThreshold, 60);
});

test('worldGenGenerate_同波不同大类可并行_同类不拆请求', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.ok(gen.WORLD_GEN_PARALLEL_LIMIT >= 2 && gen.WORLD_GEN_PARALLEL_LIMIT <= 4);
  assert.ok(gen.WORLD_GEN_MODULE_MAX_RETRIES >= 2);

  // 世界规则 / 建角同波；时间与推进单独后波（细项已折叠，不得按 6 细项各打一次）
  const ids = ['prompt', 'hub:rules', 'hub:book', 'travelTime', 'startResources', 'creation'];
  const batches = gen.resolveWorldGenBatches(ids);
  assert.equal(batches.length, 3);
  const batchWaves = gen.partitionWorldGenBatchWaves(batches.map((b) => b.id));
  assert.equal(batchWaves.length, 2, '世界规则+建角一波，时间与推进后波');
  assert.equal(batchWaves[0].length, 2);
  assert.deepEqual(batchWaves[1], ['travelTime']);

  let inflight = 0;
  let maxInflight = 0;
  let calls = 0;
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '并发测',
    setting: '测并行。',
    editorStepIds: ids,
    contentIds: wiz.contentIdsFromEditorSteps(ids),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ids,
    completeFn: async () => {
      calls += 1;
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 60));
      inflight -= 1;
      // 功能注释：同波三大类各有软校验；mock 一次返回可过各批最低字段，避免缺 startDate 触发重试刷调用次数
      return JSON.stringify({
        manifest: { description: '并发测世界摘要。' },
        content: {
          prompt: {
            scriptTone: `${'你是本世界的叙事主持人。'.repeat(8)}请保持口吻一致，遵守世界铁律，推进剧情时兼顾人物动机与节奏。`,
          },
          startDate: '2019.09.01',
          travel: { apPerTurn: 10, advanceUnit: 'day', advanceDays: 1 },
          startMoney: 3000,
        },
      });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });
  // 功能注释：3 大类；世界规则含 prompt/book 会再打补文 → 约 4 次，绝不是 6 细项各打一次
  assert.ok(calls >= 3 && calls <= 5, `6 细项合并为大类请求（可含补文），实际 ${calls}`);
  assert.equal(result.progress.total, 6, '进度行仍按细项展示');
  assert.equal(gen.worldGenBatchProgressCounts(result.progress.modules).total, 3);
  assert.ok(
    maxInflight >= 2,
    `同波不同大类应可并行，实际峰值=${maxInflight}（上限 ${gen.WORLD_GEN_PARALLEL_LIMIT}）`,
  );
  assert.ok(maxInflight <= gen.WORLD_GEN_PARALLEL_LIMIT);
});

test('worldGenGenerate_时间与推进漏写startDate须补全并标完成', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(src, /ensureWorldGenTravelTimeStartDate/);
  assert.match(src, /本批必须写 content\.startDate/);

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '都市恋曲',
    setting: '当代一线城市白领恋爱，秋季开学季入职。',
    editorStepIds: ['travelTime'],
    contentIds: wiz.contentIdsFromEditorSteps(['travelTime']),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;
  // 功能注释：模拟人物已生成，开局日期须能对齐青年年龄（现代默认年）
  seedMod.content = {
    ...seedMod.content,
    npcs: [{ id: 'n1', name: '林夏', gender: '女', age: 24, bio: '都市白领' }],
    prompt: { scriptTone: '当代都市恋爱，节奏贴近一线城市职场与秋日入职。'.repeat(2) },
  };

  let prompts = '';
  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ['travelTime'],
    // 功能注释：模拟 AI 只写 travel、漏写 startDate（线上失败场景）
    completeFn: async (_cfg, messages) => {
      prompts += messages.map((m) => m.content).join('\n');
      return JSON.stringify({
        content: { travel: { apPerTurn: 12, advanceUnit: 'day', advanceDays: 1 } },
      });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.match(prompts, /content\.startDate/);
  assert.equal(result.progress.failedCount, 0);
  assert.equal(result.progress.doneCount, 1);
  assert.equal(result.progress.modules[0].status, 'done');
  assert.doesNotMatch(result.progress.modules[0].error || '', /缺少开局日期/);
  assert.match(String(result.mod.content.startDate || ''), /^\d{4}\.\d{2}\.\d{2}$/);
  assert.equal(result.mod.content.startDate.slice(0, 4), '2024');
  assert.equal(result.mod.content.startDate.slice(5, 7), '09');

  // 功能注释：AI 若写出合法 startDate，须原样规范化保留，不得被兜底覆盖
  const withAiDate = await gen.runWorldGenModules({
    draft: { ...draft, setting: '民国上海滩的报馆与舞厅。' },
    seedMod,
    moduleIds: ['travelTime'],
    completeFn: async () =>
      JSON.stringify({
        content: { startDate: '1935年3月12日', travel: { apPerTurn: 8, advanceUnit: 'day', advanceDays: 1 } },
      }),
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });
  assert.equal(withAiDate.progress.failedCount, 0);
  assert.equal(withAiDate.mod.content.startDate, '1935.03.12');
});

test('worldGenGenerate_瞬时失败须至少重试2次后成功', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  let calls = 0;
  const out = await gen.withWorldGenRetries(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw Object.assign(new Error('fetch failed'), { status: 500 });
      }
      return 'ok';
    },
    { maxRetries: 2 },
  );
  assert.equal(out, 'ok');
  assert.equal(calls, 3, '首次+重试2次=3次调用');

  let authCalls = 0;
  await assert.rejects(
    () =>
      gen.withWorldGenRetries(async () => {
        authCalls += 1;
        throw Object.assign(new Error('请先登录'), { status: 401 });
      }, { maxRetries: 2 }),
    /请先登录/,
  );
  assert.equal(authCalls, 1, '鉴权失败不得重试');
});

test('worldGenGenerate_源码默认走平台LLM禁止个人Key门闸', () => {
  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  const plat = readFileSync(join(romance, 'lib/platformWorldGenAi.ts'), 'utf8');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(src, /completeViaPlatform|platformWorldGenAi/);
  // 功能注释：必须静态 import，禁止 await import(platformWorldGenAi) 拆成独立 chunk（发版后旧 hash 404）
  assert.match(src, /completeViaPlatform/);
  assert.match(src, /refundWorldGenPointsViaPlatform/);
  assert.match(src, /from\s*["'].*platformWorldGenAi/);
  assert.doesNotMatch(src, /await\s+import\(\s*["'].*platformWorldGenAi/);
  assert.match(src, /isFatalAuthGenError|stoppedByAuth/);
  assert.match(src, /isStaleChunkLoadErrorMessage|progressHasStaleChunkFailure/);
  assert.match(src, /WORLD_GEN_PARALLEL_LIMIT\s*=\s*[234]/);
  assert.match(src, /WORLD_GEN_BATCH_CATEGORIES|resolveWorldGenBatches|generateWorldGenBatch/);
  assert.match(src, /人物与线路/);
  assert.match(src, /WORLD_GEN_MODULE_MAX_RETRIES\s*=\s*[2-9]/);
  assert.match(src, /withWorldGenRetries/);
  assert.match(src, /shortGenError/);
  assert.match(src, /chargedPoints|module_failed_after_charge/);
  assert.doesNotMatch(src, /setInterval/);
  assert.doesNotMatch(src, /fakeProgress|mockTemplateFill|本地模板灌/);
  assert.doesNotMatch(src, /isConfigured\(cfg\)/);
  assert.match(plat, /\/api\/romance\/world-gen\/complete/);
  assert.match(plat, /\/api\/romance\/world-gen\/refund/);
  assert.match(plat, /pointsDeducted/);
  assert.match(plat, /refundWorldGenPointsViaPlatform/);
  assert.doesNotMatch(plat, /平台接口地址未配置/);
  assert.doesNotMatch(plat, /loadConfig\(|cfg\.apiKey/);
  assert.match(wiz, /readFunloomAuthToken/);
  assert.doesNotMatch(wiz, /isConfigured\(loadConfig/);
  // 功能注释：进度页去掉重试入口；底部仅「进入编辑器」与「返回」
  assert.doesNotMatch(wiz, /单独重试|单条重试/);
  assert.doesNotMatch(wiz, /重试失败项/);
  assert.doesNotMatch(wiz, /retryFailedWorldGenModules|retryOneWorldGenModule/);
  assert.doesNotMatch(wiz, /进入编辑器（保留已完成）|进入空编辑器/);
  assert.doesNotMatch(wiz, /返回修改设定/);
  assert.match(wiz, /进入编辑器/);
  assert.match(wiz, />\s*返回\s*</);
  assert.match(wiz, /已完成 \{progress\.doneCount\}\/\{progress\.total\}/);
  assert.match(wiz, /失败 \$\{progress\.failedCount\}/);
  assert.match(wiz, /moduleStatusLabel/);
  assert.match(wiz, /已完成/);
  assert.match(wiz, /取消生成/);
  assert.match(wiz, /progressHasAuthFailure|平台 AI/);
  assert.match(wiz, /progressHasStaleChunkFailure/);
  assert.match(wiz, /estimateWorldGenEtaSeconds/);
  assert.match(wiz, /预计耗时/);
  assert.match(wiz, /genStartedAtRef|markGenStart/);
});

test('isStaleChunkLoadErrorMessage_识别动态模块404', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.equal(
    mod.isStaleChunkLoadErrorMessage(
      'Failed to fetch dynamically imported module: http://gogo.kurangames.cn/funloom/assets/platformWorldGenAi-CHUBrXLc.js',
    ),
    true,
  );
  assert.equal(
    mod.isStaleChunkLoadErrorMessage(
      'Failed to fetch dynamically imported module: http://gogo.kurangames.cn/funloom/assets/ModEditorPanel-D-E2Pbnu.js',
    ),
    true,
  );
  assert.equal(mod.isStaleChunkLoadErrorMessage('积分不足'), false);
  assert.equal(
    mod.progressHasStaleChunkFailure({
      modules: [
        { id: 'a', name: 'x', status: 'failed', error: 'Failed to fetch dynamically imported module: x.js' },
      ],
      doneCount: 0,
      failedCount: 1,
      total: 1,
      label: '',
      cancelled: false,
    }),
    true,
  );
});

test('reloadOnceForStaleChunk_非chunk错误不刷新_同会话只刷一次', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.equal(mod.reloadOnceForStaleChunk('积分不足'), false);
  assert.equal(typeof mod.STALE_CHUNK_RELOAD_KEY, 'string');
  assert.match(mod.STALE_CHUNK_RELOAD_KEY, /staleChunkReload/);
  // 功能注释：无 window/sessionStorage 的 node 环境应安全返回 false
  assert.equal(
    mod.reloadOnceForStaleChunk(
      'Failed to fetch dynamically imported module: http://gogo.kurangames.cn/funloom/assets/ModEditorPanel-D-E2Pbnu.js',
    ),
    false,
  );
});

test('importWithStaleChunkReload_成功透传_非chunk失败原样抛出', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const ok = await mod.importWithStaleChunkReload(async () => ({ default: 1 }));
  assert.deepEqual(ok, { default: 1 });
  await assert.rejects(
    () => mod.importWithStaleChunkReload(async () => {
      throw new Error('积分不足');
    }),
    /积分不足/,
  );
});

test('worldGenGenerate_预计耗时秒数_无样本用并行fallback_有样本用速率', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const fallback = gen.WORLD_GEN_ETA_FALLBACK_SEC_PER_MODULE;
  // 23 大类 / 并行 3 → ceil(23/3)=8 批 × fallback
  assert.equal(
    gen.estimateWorldGenEtaSeconds({ total: 23, finished: 0, elapsedMs: 0, parallelLimit: 3 }),
    8 * fallback,
  );
  assert.equal(
    gen.estimateWorldGenEtaSeconds({ total: 23, finished: 0, elapsedMs: 100, parallelLimit: 3 }),
    8 * fallback,
  );
  // 已完成全部 → 0
  assert.equal(
    gen.estimateWorldGenEtaSeconds({ total: 10, finished: 10, elapsedMs: 5000, parallelLimit: 3 }),
    0,
  );
  // 3 完成耗时 90s → 每项 30s；剩 7 → byRate 210；byFallback=ceil(7/3)*fallback
  assert.equal(
    gen.estimateWorldGenEtaSeconds({
      total: 10,
      finished: 3,
      elapsedMs: 90_000,
      parallelLimit: 3,
    }),
    Math.max(210, Math.ceil(7 / 3) * fallback),
  );
  // 前期快完成拉低均值时，须不低于 fallback 批次（18 完成 60s、剩 4、并行 8 → rate≈14）
  assert.equal(
    gen.estimateWorldGenEtaSeconds({
      total: 22,
      finished: 18,
      elapsedMs: 60_000,
      parallelLimit: 8,
    }),
    Math.max(14, Math.ceil(4 / 8) * fallback),
  );
  // 非法输入兜底
  assert.equal(gen.estimateWorldGenEtaSeconds({ total: -1, finished: 5, elapsedMs: 0 }), 0);
});

test('worldGenGenerate_预计耗时须按deadline每秒递减且可按进度重标定', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const t0 = 1_700_000_000_000;
  const deadline = gen.worldGenEtaDeadlineMs(320, t0);
  assert.equal(deadline, t0 + 320_000);
  assert.equal(
    gen.worldGenEtaDisplaySeconds({ deadlineMs: deadline, nowMs: t0, remainingModules: 22 }),
    320,
  );
  assert.equal(
    gen.worldGenEtaDisplaySeconds({ deadlineMs: deadline, nowMs: t0 + 5_000, remainingModules: 22 }),
    315,
  );
  // 瞬时底层仍可返回 1；UI 须在 overdue 时重标定（见 NeedsRecalibrate）
  assert.equal(
    gen.worldGenEtaDisplaySeconds({ deadlineMs: deadline, nowMs: t0 + 400_000, remainingModules: 22 }),
    1,
  );
  assert.equal(
    gen.worldGenEtaDisplaySeconds({ deadlineMs: deadline, nowMs: t0 + 10_000, remainingModules: 0 }),
    0,
  );
  // 进度推进后用新剩余重标定，展示应跳到新值而非卡在旧倒计时
  const recalibrated = gen.worldGenEtaDeadlineMs(90, t0 + 60_000);
  assert.equal(
    gen.worldGenEtaDisplaySeconds({
      deadlineMs: recalibrated,
      nowMs: t0 + 60_000,
      remainingModules: 14,
    }),
    90,
  );
});

test('worldGenGenerate_截止已过仍有剩余须重标定', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const t0 = 1_700_000_000_000;
  const deadline = gen.worldGenEtaDeadlineMs(25, t0);
  assert.equal(
    gen.worldGenEtaNeedsRecalibrate({
      deadlineMs: deadline,
      nowMs: t0 + 30_000,
      remainingModules: 4,
      finishedChanged: false,
      hasDeadline: true,
    }),
    true,
  );
  assert.equal(
    gen.worldGenEtaNeedsRecalibrate({
      deadlineMs: deadline,
      nowMs: t0 + 10_000,
      remainingModules: 4,
      finishedChanged: false,
      hasDeadline: true,
    }),
    false,
  );
  assert.equal(
    gen.worldGenEtaNeedsRecalibrate({
      deadlineMs: deadline,
      nowMs: t0 + 10_000,
      remainingModules: 4,
      finishedChanged: true,
      hasDeadline: true,
    }),
    true,
  );
  assert.equal(
    gen.worldGenEtaNeedsRecalibrate({
      deadlineMs: 0,
      nowMs: t0,
      remainingModules: 4,
      finishedChanged: false,
      hasDeadline: false,
    }),
    true,
  );
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /worldGenEtaNeedsRecalibrate/);
});

test('worldGenGenerate_预计耗时须拆成分秒', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.deepEqual(gen.formatWorldGenEtaParts(320), { minutes: 5, seconds: 20 });
  assert.deepEqual(gen.formatWorldGenEtaParts(59), { minutes: 0, seconds: 59 });
  assert.deepEqual(gen.formatWorldGenEtaParts(60), { minutes: 1, seconds: 0 });
  assert.deepEqual(gen.formatWorldGenEtaParts(0), { minutes: 0, seconds: 0 });
  assert.deepEqual(gen.formatWorldGenEtaParts(-3), { minutes: 0, seconds: 0 });
  // 0 分只显示秒，禁止「0分」
  assert.equal(gen.formatWorldGenEtaLabel({ minutes: 0, seconds: 25 }), '25秒');
  assert.equal(gen.formatWorldGenEtaLabel({ minutes: 0, seconds: 0 }), '0秒');
  assert.equal(gen.formatWorldGenEtaLabel({ minutes: 1, seconds: 5 }), '1分05秒');
  assert.equal(gen.formatWorldGenEtaLabel({ minutes: 5, seconds: 20 }), '5分20秒');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /formatWorldGenEtaParts/);
  assert.match(wiz, /etaParts\.minutes > 0/);
  assert.doesNotMatch(wiz, /aria-label=\{`预计耗时 \$\{etaParts\.minutes\} 分/);
});

test('worldGenGenerate_进行中列表应滚到首个running', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.equal(gen.pickWorldGenScrollTargetId(null), null);
  assert.equal(gen.pickWorldGenScrollTargetId([]), null);
  assert.equal(
    gen.pickWorldGenScrollTargetId([
      { id: 'a', status: 'done' },
      { id: 'b', status: 'running' },
      { id: 'c', status: 'running' },
      { id: 'd', status: 'pending' },
    ]),
    'b',
  );
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /pickWorldGenScrollTargetId|scrollIntoView|modListRef/);
  assert.match(wiz, /is-running|data-wg-status/);
  const css = readFileSync(join(romance, 'index.css'), 'utf8');
  assert.match(css, /\.world-gen-mod-row\.is-running/);
  assert.match(css, /world-gen-row-active/);
});

test('worldGenGenerate_结束后应滚到首个失败并有强调动画', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.equal(
    gen.pickWorldGenScrollTargetId(
      [
        { id: 'a', status: 'done' },
        { id: 'b', status: 'failed' },
        { id: 'c', status: 'failed' },
      ],
      { prefer: 'failed' },
    ),
    'b',
  );
  assert.equal(
    gen.pickWorldGenScrollTargetId([
      { id: 'a', status: 'done' },
      { id: 'b', status: 'failed' },
    ]),
    'b',
  );
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /settledFailKey|is-attention/);
  assert.match(wiz, /prefer:\s*"failed"/);
  const css = readFileSync(join(romance, 'index.css'), 'utf8');
  assert.match(css, /\.world-gen-mod-row\.is-failed\.is-attention/);
  assert.match(css, /world-gen-fail-attention/);
});

test('platformWorldGenAi_空基址须拼同源api路径', async () => {
  const plat = await import(pathToFileURL(join(romance, 'lib/platformWorldGenAi.ts')).href);
  assert.equal(plat.worldGenCompleteUrl(''), '/api/romance/world-gen/complete');
  assert.equal(
    plat.worldGenCompleteUrl('https://kurangames.cn/cn-test-api'),
    'https://kurangames.cn/cn-test-api/api/romance/world-gen/complete',
  );
});

test('worldGenGenerate_基础补丁须剥离扩展玩法键', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const cleaned = gen.sanitizeWorldGenAiPatch('npcs', {
    npcs: [{ id: 'a', name: '阿宁' }],
    gigs: [{ id: 'g1' }],
    playModInstalls: [{ slug: 'pack-career' }],
    pregnancy: { weeks: 40 },
    features: { industryTab: true, career: true },
  });
  assert.equal(cleaned.npcs[0].name, '阿宁');
  assert.equal(cleaned.gigs, undefined);
  assert.equal(cleaned.playModInstalls, undefined);
  assert.equal(cleaned.pregnancy, undefined);
  assert.equal(cleaned.features.industryTab, false);
  assert.equal(cleaned.features.career, false);

  const gigPatch = gen.sanitizeWorldGenAiPatch('gigs', { gigs: [{ id: 'g1' }], pregnancy: { weeks: 1 } });
  assert.equal(gigPatch.gigs[0].id, 'g1');
  assert.equal(gigPatch.pregnancy, undefined);
});

test('worldGenGenerate_人脉补丁须丢弃组织与自定义分组', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const patch = gen.sanitizeWorldGenAiPatch('contacts', {
    contacts: {
      groups: [{ id: 'sect', label: '青云宗' }],
      orgs: [{ id: 'qingyun', label: '青云宗' }],
      stages: [{ id: 'friend', label: '好友', min: 40, groups: ['sect'] }],
      metrics: [{ src: { kind: 'rel' }, icon: 'heart' }],
    },
  });
  assert.equal(patch.contacts.groups, undefined);
  assert.equal(patch.contacts.orgs, undefined);
  assert.equal(patch.contacts.stages[0].groups, undefined);
});
