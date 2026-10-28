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
    const last = messages[messages.length - 1].content;
    if (String(last).includes('人物（模组库）') || String(last).includes('「人物')) {
      return JSON.stringify({ content: { npcs: [{ id: 'n1', name: '阿宁', role: '店主', kind: 'staff', home: 'start', roam: [], bio: '温柔', gender: '女', age: 28 }] } });
    }
    if (String(last).includes('地点（模组库）') || String(last).includes('「地点')) {
      return JSON.stringify({ content: { rooms: { start: { name: '雾港旅店', desc: '靠海', exits: {} } }, startRoom: 'start' } });
    }
    throw new Error(`意外模组提示: ${String(last).slice(0, 80)}`);
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

  assert.equal(calls.length, 2, '只勾选角色与地点时只能调用两次 AI');
  assert.equal(result.progress.doneCount, 2);
  assert.equal(result.progress.failedCount, 0);
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
  assert.equal(result.progress.modules[0].status, 'failed');
  assert.match(result.progress.modules[0].error || '', /服务暂时异常|失败|boom|500/);
  assert.equal(result.mod.content.npcs, undefined);
});

test('worldGenGenerate_鉴权失败须立刻停批且不打下一波', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  // prompt 在第 1 波，npcs/rooms 在第 2 波；第 1 波鉴权失败后不得进入第 2 波
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

  assert.equal(calls, 1, '鉴权失败时禁止进入下一波模组');
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

test('worldGenGenerate_同波应并行且合并结果', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  const waves = gen.partitionWorldGenWaves(['prompt', 'npcs', 'rooms', 'fixedEvents', 'gigs']);
  assert.ok(waves[0].includes('prompt'));
  assert.ok(waves[1].includes('npcs') && waves[1].includes('rooms'));
  assert.ok(waves[2].includes('fixedEvents'));
  assert.ok(waves.some((w) => w.includes('gigs')), '扩展模组落入末波');

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    editorStepIds: ['npcs', 'rooms', 'relations'],
    contentIds: wiz.contentIdsFromEditorSteps(['npcs', 'rooms', 'relations']),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  let inflight = 0;
  let maxInflight = 0;
  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ['npcs', 'rooms', 'relations'],
    completeFn: async (_cfg, messages) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 40));
      inflight -= 1;
      const last = messages[messages.length - 1].content;
      if (String(last).includes('人物（模组库）') || String(last).includes('「人物')) {
        return JSON.stringify({ content: { npcs: [{ id: 'n1', name: '阿宁' }] } });
      }
      if (String(last).includes('地点') || String(last).includes('rooms')) {
        return JSON.stringify({ content: { rooms: { start: { name: '旅店', desc: '', exits: {} } } } });
      }
      return JSON.stringify({ content: { relations: { confessThreshold: 60 } } });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.ok(maxInflight >= 2, `同波应并行，实际峰值并发=${maxInflight}`);
  assert.equal(result.progress.doneCount, 3);
  assert.equal(result.mod.content.npcs[0].name, '阿宁');
  assert.equal(result.mod.content.rooms.start.name, '旅店');
});

test('worldGenGenerate_无依赖同波并发上限应为6到8', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.ok(gen.WORLD_GEN_PARALLEL_LIMIT >= 6 && gen.WORLD_GEN_PARALLEL_LIMIT <= 8);
  assert.ok(gen.WORLD_GEN_MODULE_MAX_RETRIES >= 2);

  // 同波 8 个无依赖项（第一波骨架）应能同时拉满并行
  const ids = ['prompt', 'hub:rules', 'hub:book', 'travelTime', 'startResources', 'stats', 'creationFields', 'creationPools'];
  const waves = gen.partitionWorldGenWaves(ids);
  assert.equal(waves.length, 1, '所选 id 应同属第一波');
  assert.equal(waves[0].length, 8);

  let inflight = 0;
  let maxInflight = 0;
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

  await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ids,
    completeFn: async () => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 60));
      inflight -= 1;
      return JSON.stringify({ content: {} });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });
  assert.ok(
    maxInflight >= 6,
    `无依赖同波并发应≥6，实际峰值=${maxInflight}（上限 ${gen.WORLD_GEN_PARALLEL_LIMIT}）`,
  );
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
  assert.match(src, /import\s*\{\s*completeViaPlatform\s*\}\s*from\s*["'].*platformWorldGenAi/);
  assert.doesNotMatch(src, /await\s+import\(\s*["'].*platformWorldGenAi/);
  assert.match(src, /isFatalAuthGenError|stoppedByAuth/);
  assert.match(src, /isStaleChunkLoadErrorMessage|progressHasStaleChunkFailure/);
  assert.match(src, /WORLD_GEN_PARALLEL_LIMIT\s*=\s*[678]/);
  assert.match(src, /WORLD_GEN_MODULE_MAX_RETRIES\s*=\s*[2-9]/);
  assert.match(src, /withWorldGenRetries/);
  assert.doesNotMatch(src, /setInterval/);
  assert.doesNotMatch(src, /fakeProgress|mockTemplateFill|本地模板灌/);
  assert.doesNotMatch(src, /isConfigured\(cfg\)/);
  assert.match(plat, /\/api\/romance\/world-gen\/complete/);
  assert.doesNotMatch(plat, /平台接口地址未配置/);
  assert.doesNotMatch(plat, /loadConfig\(|cfg\.apiKey/);
  assert.match(wiz, /readFunloomAuthToken/);
  assert.doesNotMatch(wiz, /isConfigured\(loadConfig/);
  assert.match(wiz, /单独重试/);
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

test('worldGenGenerate_预计耗时秒数_无样本用并行fallback_有样本用速率', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  // 23 项 / 并行 3 → ceil(23/3)=8 批 × 40s = 320（标定值，倒计由 deadline 负责）
  assert.equal(
    gen.estimateWorldGenEtaSeconds({ total: 23, finished: 0, elapsedMs: 0, parallelLimit: 3 }),
    320,
  );
  assert.equal(
    gen.estimateWorldGenEtaSeconds({ total: 23, finished: 0, elapsedMs: 100, parallelLimit: 3 }),
    320,
  );
  // 已完成全部 → 0
  assert.equal(
    gen.estimateWorldGenEtaSeconds({ total: 10, finished: 10, elapsedMs: 5000, parallelLimit: 3 }),
    0,
  );
  // 3 完成耗时 90s → 每项 30s；剩 7 → ceil(210)=210
  assert.equal(
    gen.estimateWorldGenEtaSeconds({
      total: 10,
      finished: 3,
      elapsedMs: 90_000,
      parallelLimit: 3,
    }),
    210,
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

test('worldGenGenerate_预计耗时须拆成分秒', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.deepEqual(gen.formatWorldGenEtaParts(320), { minutes: 5, seconds: 20 });
  assert.deepEqual(gen.formatWorldGenEtaParts(59), { minutes: 0, seconds: 59 });
  assert.deepEqual(gen.formatWorldGenEtaParts(60), { minutes: 1, seconds: 0 });
  assert.deepEqual(gen.formatWorldGenEtaParts(0), { minutes: 0, seconds: 0 });
  assert.deepEqual(gen.formatWorldGenEtaParts(-3), { minutes: 0, seconds: 0 });
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(wiz, /formatWorldGenEtaParts/);
  assert.match(wiz, /world-gen-eta-unit[\s\S]*分[\s\S]*秒|分[\s\S]*秒/);
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
