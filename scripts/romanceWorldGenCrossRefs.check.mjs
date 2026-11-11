/**
 * 生成世界 · 跨批 id 契约（R3–R9）：第 2 次只能引用第 1 次已有 id；
 * 世界书挂靠在人物地点之后填；人物 home 是 room id；事件/主线不编造 fame；关系/势力/流浪按设定出现。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const load = (p) => import(pathToFileURL(join(romance, p)).href);

const BIO = '这是一段足够长的人物小传，用来通过软校验：写出动机与处境。';
const rooms = {
  lobby: { name: '旅店前厅', desc: '木地板与海风。' },
  kitchen: { name: '后厨', desc: '锅铲声不断。' },
  attic: { name: '阁楼', desc: '旧箱子堆着。' },
};
const baseContent = {
  customAttrs: [
    { id: 'insight', label: '洞察', desc: '察言观色' },
    { id: 'charm', label: '魅力', desc: '待客手腕' },
  ],
  moneyLabel: '元',
  worldBook: [
    { id: 'wb1', title: '潮汐', keywords: ['潮汐'], content: '后厨的人最清楚潮汐表。', enabled: true },
    { id: 'wb2', title: '旧账本', keywords: ['账本'], content: '与某个人有关的旧账。', enabled: true },
  ],
  creation: {
    paths: [
      { id: 'path-heir', name: '旅店继承人', about: '沈晚晴等你回来接手。' },
      { id: 'path-ghost', name: '无人认领的线路', about: '没有任何人物对应。' },
    ],
  },
  startDate: '2019.09.01',
};
const npc = (id, name, extra = {}) => ({ id, name, gender: '女', age: 24, role: '住客', home: 'lobby', bio: BIO, ...extra });

test('crossRefs_人物home地名对回id_对不上保留原值并软校验失败', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const out = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms,
    startRoom: '旅店前厅',
    npcs: [npc('n1', '沈晚晴', { home: '后厨' }), npc('n2', '林夏', { home: '不存在的地方' })],
  });
  assert.equal(out.npcs[0].home, 'kitchen');
  assert.equal(out.npcs[1].home, '不存在的地方', '禁止把对不上的 home 清空');
  const err = gen.softValidateBatchPatch(['npcs', 'rooms'], { ...out, startRoom: 'lobby' });
  assert.match(String(err), /home/);
  assert.equal(
    gen.softValidateBatchPatch(['npcs', 'rooms'], { rooms, startRoom: 'lobby', npcs: [npc('n1', '沈晚晴')] }),
    null,
  );
  // 功能注释：缺 home 也要打回，且只对照 rooms
  assert.match(
    String(gen.softValidateBatchPatch(['npcs', 'rooms'], { rooms, startRoom: 'lobby', npcs: [npc('n1', '沈晚晴', { home: '' })] })),
    /缺少 home/,
  );
});

test('crossRefs_startRoom必须是rooms的id且locations被剥掉', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const patch = gen.sanitizeWorldGenBatchPatch(['rooms'], {
    rooms,
    startRoom: 'lobby',
    locations: [{ id: 'lobby', name: '旅店前厅' }],
  });
  assert.equal('locations' in patch, false);
  assert.equal(gen.softValidateBatchPatch(['rooms'], patch), null);
  assert.match(String(gen.softValidateBatchPatch(['rooms'], { rooms, startRoom: 'nowhere' })), /startRoom/);
  assert.match(String(gen.softValidateBatchPatch(['rooms'], { rooms })), /startRoom/);
});

test('crossRefs_世界书第1次不写挂靠_第2次只留有效id并按名自动回填', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const phase1 = gen.sanitizeWorldGenBatchPatch(['hub:book'], {
    worldBook: [{ id: 'wb1', title: '潮汐', keywords: ['潮汐'], content: '海边的潮汐。', enabled: true, bindRooms: ['x'], bindNpcs: ['y'] }],
  });
  assert.equal('bindRooms' in phase1.worldBook[0], false);
  assert.equal('bindNpcs' in phase1.worldBook[0], false);

  const ctx = { content: baseContent, settingText: '海边旅店的故事' };
  const phase2 = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms,
    startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴'), npc('n2', '林夏', { home: 'kitchen' })],
    worldBook: [
      // 功能注释：一条写了有效 + 无效 id，另一条没写，靠标题正文里的人名地名自动回填
      { id: 'wb1', bindRooms: ['kitchen', 'ghost-room'], bindNpcs: ['n2', 'n999'] },
    ],
  }, ctx);
  const wb1 = phase2.worldBook.find((w) => w.id === 'wb1');
  assert.deepEqual(wb1.bindRooms, ['kitchen']);
  assert.deepEqual(wb1.bindNpcs, ['n2']);
  const wb2 = phase2.worldBook.find((w) => w.id === 'wb2');
  assert.equal(wb2, undefined, '没有任何可对上的人名地名就不绑，不得编造');

  const wbNamed = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms,
    startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴')],
  }, { content: { ...baseContent, worldBook: [{ id: 'wb3', title: '沈晚晴的旧事', keywords: [], content: '在后厨发生。', enabled: true }] }, settingText: '' });
  assert.deepEqual(wbNamed.worldBook[0], { id: 'wb3', bindRooms: ['kitchen'], bindNpcs: ['n1'] });
  // 功能注释：合并进第 1 次世界书时按 id 补挂靠，不丢标题正文
  const merged = gen.mergeModContent({ worldBook: baseContent.worldBook }, { worldBook: [{ id: 'wb1', bindRooms: ['kitchen'] }] });
  assert.equal(merged.worldBook.find((w) => w.id === 'wb1').title, '潮汐');
  assert.deepEqual(merged.worldBook.find((w) => w.id === 'wb1').bindRooms, ['kitchen']);
});

test('crossRefs_势力名单单一来源_设定无组织则人物无势力', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const withOrgs = { content: { ...baseContent, creation: { ...baseContent.creation, startFactions: [{ id: 'guild', name: '行会' }] } }, settingText: '港口行会把持商路' };
  const kept = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms, startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴', { factionId: 'guild' }), npc('n2', '林夏', { factionId: 'faction-royal' })],
  }, withOrgs);
  assert.equal(kept.npcs[0].factionId, 'guild');
  assert.equal('factionId' in kept.npcs[1], false);

  const noOrgs = gen.sanitizeWorldGenBatchPatch(['hub:paths'], {
    creation: { startFactions: [{ id: 'guild', name: '行会' }], paths: [] },
  }, { content: {}, settingText: '一间安静的海边旅店，没有别的。' });
  assert.equal('startFactions' in noOrgs.creation, false, '设定没有组织就不生成势力名单');
  const npcsNoOrg = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms, startRoom: 'lobby', npcs: [npc('n1', '沈晚晴', { factionId: 'guild' })],
  }, { content: baseContent, settingText: '一间安静的海边旅店。' });
  assert.equal('factionId' in npcsNoOrg.npcs[0], false);
});

test('crossRefs_事件只用已有属性id_没有fame绝不写fame_nextIds只指同批', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const ctx = {
    content: { ...baseContent, npcs: [], rooms },
    settingText: '海边旅店日常。',
  };
  const ev = (i, extra = {}) => ({
    id: `fx_${i}`,
    name: `事件${i}`,
    prompt: `第 ${i} 幕：旅店里发生了一件需要主角当场处理的事，之后会留下可结算的后果。`,
    effects: [{ kind: 'stat', key: 'insight', delta: 2 }],
    trigger: { kind: 'auto' },
    ...extra,
  });
  const out = gen.sanitizeWorldGenBatchPatch(['fixedEvents'], {
    fixedEvents: [
      ev(1, {
        nextIds: ['fx_2', 'fx_ghost', 'fx_1'],
        openingPrompt: true,
        effects: [
          { kind: 'stat', key: 'insight', delta: 2 },
          { kind: 'metric', key: 'fame', delta: 5 },
          { kind: 'rel', key: 'n1', delta: 3 },
          { kind: 'unlockLocation', key: 'attic' },
          { kind: 'unlockLocation', key: 'moon' },
          { kind: 'faction', key: 'guild', delta: 1 },
        ],
        choices: [
          { id: 'c1', label: '收留', effects: [{ kind: 'metric', key: 'fame', delta: 1 }, { kind: 'stat', key: 'charm', delta: 1 }], nextIds: ['fx_2', 'fx_x'] },
          { id: 'c2', label: '' },
        ],
      }),
      ev(2),
      ev(3, { effects: [{ kind: 'metric', key: 'fame', delta: 9 }] }),
    ],
  }, ctx);
  assert.equal(out.fixedEvents.length, 3, '只有 fame 后果的事件保留为纯叙事事件，不整条丢弃');
  assert.equal(out.fixedEvents[2].effects, undefined, 'fame 后果被剥掉，且不自动补 fame');
  const first = out.fixedEvents[0];
  assert.deepEqual(first.effects.map((e) => `${e.kind}:${e.key}`), ['metric:c:insight', 'unlockLocation:attic']);
  assert.deepEqual(first.nextIds, ['fx_2']);
  assert.equal(first.openingPrompt, true);
  assert.equal(first.choices.length, 1);
  assert.deepEqual(first.choices[0].effects.map((e) => e.key), ['c:charm']);
  assert.deepEqual(first.choices[0].nextIds, ['fx_2']);
  assert.doesNotMatch(JSON.stringify(out.fixedEvents), /fame|faction|"rel"/);
  assert.equal(gen.softValidateBatchPatch(['fixedEvents'], out), null);
});

test('crossRefs_事件效果key写中文名或漏kind时对回属性id_事件不被清空', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const ctx = { content: { ...baseContent, npcs: [], rooms }, settingText: '海边旅店日常。' };
  const attrs = baseContent.customAttrs;
  const first = attrs[0];
  const out = gen.sanitizeWorldGenBatchPatch(['fixedEvents'], {
    fixedEvents: [{
      id: 'fx_cn',
      name: '雨夜来客',
      prompt: '暴雨夜一位浑身湿透的旅人敲门求宿，主角需要决定是否收留他。',
      effects: [
        { kind: 'stat', key: first.label, delta: 2 },
        { key: first.id.toUpperCase(), delta: 1 },
        { kind: 'attr', key: first.label, delta: 1 },
      ],
    }],
  }, ctx);
  assert.equal(out.fixedEvents.length, 1, '事件不应被清空');
  assert.deepEqual(out.fixedEvents[0].effects.map((e) => `${e.kind}:${e.key}`), [`metric:c:${first.id}`, `metric:c:${first.id}`, `metric:c:${first.id}`]);
  assert.equal(gen.softValidateBatchPatch(['fixedEvents'], out), null);
});

test('crossRefs_设定有恋爱时才保留rel效果与metStart_否则剥掉', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const patch = () => ({
    rooms, startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴', { metStart: true, wxStart: true })],
    fixedEvents: [{
      id: 'fx_1', name: '重逢', trigger: { kind: 'auto' },
      prompt: '重逢那天海风很大，两个人站在码头上谁都没先开口，只有潮声。',
      effects: [{ kind: 'rel', key: 'n1', delta: 4 }, { kind: 'stat', key: 'insight', delta: 1 }],
    }],
  });
  const plain = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms', 'fixedEvents'], patch(), { content: baseContent, settingText: '海边旅店日常经营。' });
  assert.equal('metStart' in plain.npcs[0], false);
  assert.equal('wxStart' in plain.npcs[0], false);
  // 功能注释：自定义属性在引擎里是 metric + c: 前缀（见 worldGenCrossRefs），不是 stat
  assert.deepEqual(plain.fixedEvents[0].effects.map((e) => e.kind), ['metric']);

  const love = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms', 'fixedEvents'], patch(), { content: baseContent, settingText: '海边旅店的恋爱故事，好感会慢慢涨。' });
  assert.equal(love.npcs[0].metStart, true);
  assert.equal(love.npcs[0].wxStart, true);
  assert.deepEqual(love.fixedEvents[0].effects.map((e) => e.kind), ['rel', 'metric']);
});

test('crossRefs_只有设定写了流浪者才roam_否则固定在home', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const patch = () => ({
    rooms, startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴', { kind: 'roam', roam: ['kitchen', '阁楼', 'ghost'] })],
  });
  const fixed = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], patch(), { content: baseContent, settingText: '海边旅店日常。' });
  assert.notEqual(fixed.npcs[0].kind, 'roam');
  assert.deepEqual(fixed.npcs[0].roam, []);
  assert.equal(fixed.npcs[0].home, 'lobby');
  const wander = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], patch(), { content: baseContent, settingText: '一位四处流浪的旅人途经旅店。' });
  assert.equal(wander.npcs[0].kind, 'roam');
  assert.deepEqual(wander.npcs[0].roam, ['kitchen', 'attic']);
});

test('crossRefs_年龄收成单值_设定唯一年份对齐startDate', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const out = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms, startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴', { age: '25-30岁' })],
    startDate: '2024.03.15',
  }, { content: baseContent, settingText: '1935 年的海边旅店，战乱前夜。' });
  assert.equal(out.npcs[0].age, 25);
  assert.equal(out.startDate, '1935.03.15');
  const same = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms, startRoom: 'lobby', npcs: [npc('n1', '沈晚晴')],
  }, { content: baseContent, settingText: '当代海边旅店。' });
  assert.equal(same.startDate, '2019.09.01', '设定没写年份时保持第1次的 startDate');
  assert.match(
    String(gen.softValidateBatchPatch(['npcs', 'rooms'], { rooms, startRoom: 'lobby', npcs: [npc('n1', '周明远', { age: 300 })] })),
    /年龄/,
  );
});

test('crossRefs_线路回填hero与room_没有对应人物的线路被删', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const out = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms, startRoom: 'lobby',
    npcs: [npc('n1', '沈晚晴', { home: 'kitchen' })],
  }, { content: baseContent, settingText: '海边旅店。' });
  assert.deepEqual(out.creation.paths.map((p) => p.id), ['path-heir']);
  assert.equal(out.creation.paths[0].hero, 'n1');
  assert.equal(out.creation.paths[0].room, 'kitchen');
  const byId = gen.sanitizeWorldGenBatchPatch(['npcs', 'rooms'], {
    rooms, startRoom: 'lobby',
    npcs: [npc('n1', '林夏', { pathId: 'path-ghost', home: 'attic' })],
  }, { content: baseContent, settingText: '海边旅店。' });
  assert.deepEqual(byId.creation.paths.map((p) => p.id), ['path-ghost']);
  assert.equal(byId.creation.paths[0].room, 'attic');
  assert.equal('pathId' in byId.npcs[0], false);
});

test('crossRefs_主线条件不自动补fame_只认已有属性', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const out = gen.sanitizeWorldGenBatchPatch(['storylines'], {
    storylines: [{
      id: 'main', name: '主线',
      nodes: [
        { id: 'a', name: '接手', desc: '熟悉账本', conds: [{ kind: 'metric', key: 'fame', op: 'gte', value: 10 }] },
        { id: 'b', name: '站稳', desc: '客人满意', conds: [{ kind: 'stat', key: 'insight', op: 'gte', value: 30 }, { kind: 'item', key: 'x' }] },
        { id: 'c', name: '收尾', desc: '年终', conds: [] },
      ],
    }],
  }, { content: baseContent, settingText: '' });
  const nodes = out.storylines[0].nodes;
  assert.deepEqual(nodes[0].conds, []);
  assert.deepEqual(nodes[1].conds, [{ kind: 'metric', key: 'c:insight', op: 'gte', value: 30 }]);
  assert.deepEqual(nodes[2].conds, []);
  assert.doesNotMatch(JSON.stringify(out), /fame/);
});

test('crossRefs_软上限只在超过宽松区间时失败', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  assert.equal(gen.WORLD_GEN_NPCS_SOFT_MAX, 12);
  const many = {};
  for (let i = 1; i <= 17; i += 1) many[`r${i}`] = { name: `地点${i}`, desc: `地点${i}的场景。` };
  assert.match(String(gen.softValidateBatchPatch(['rooms'], { rooms: many, startRoom: 'r1' })), /地点过多/);
  const nine = {};
  for (let i = 1; i <= 9; i += 1) nine[`r${i}`] = { name: `地点${i}`, desc: `地点${i}的场景。` };
  assert.equal(gen.softValidateBatchPatch(['rooms'], { rooms: nine, startRoom: 'r1' }), null, '超出建议的 3–8 也接受');
  const fifteen = Array.from({ length: 15 }, (_, i) => npc(`n${i}`, `人物${i}`));
  const out = gen.sanitizeWorldGenBatchPatch(['npcs'], { npcs: fifteen });
  assert.equal(out.npcs.length, 12);
});

test('crossRefs_第2次请求带第1次id与完整基调_世界书不在第1次写挂靠', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const wiz = await load('lib/worldGenWizard.ts');
  const tone = `${'你是雾港旅店叙事主持人，保持口吻一致。'.repeat(60)}终。`;
  assert.ok(tone.length > 1000 && tone.length < 5000);
  const ids = ['prompt', 'hub:book', 'travelTime', 'creation', 'startResources', 'hub:paths', 'npcs', 'rooms', 'fixedEvents', 'storylines'];
  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '当代海边旅店继承与人情往来，没有任何组织势力。',
    editorStepIds: ids,
    contentIds: wiz.contentIdsFromEditorSteps(ids),
  };
  const { meta: _m, ...seedMod } = wiz.draftModFromWorldGen(draft);
  void _m;
  const prompts = [];
  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: ids,
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
    completeFn: async (_cfg, messages) => {
      const last = String(messages[messages.length - 1].content);
      prompts.push(last);
      if (last.includes('当前大类：「基础设定」')) {
        return JSON.stringify({
          manifest: { description: '雾港旅店继承故事。' },
          content: {
            prompt: { scriptTone: tone },
            worldBook: [{ id: 'wb1', title: '雾港潮汐', keywords: '潮汐', content: '潮汐影响客流，后厨最清楚。', enabled: true, bindRooms: ['x'], bindNpcs: ['y'] }],
            startDate: '2019.09.01',
            travel: { apPerTurn: 10, advanceUnit: 'day', advanceDays: 1 },
            startMoney: 3000,
            moneyLabel: '元',
            customAttrs: [
              { id: 'insight', label: '洞察', desc: '察言观色', min: 0, max: 100, init: 40 },
              { id: 'charm', label: '魅力', desc: '待客手腕', min: 0, max: 100, init: 45 },
            ],
            creation: { paths: [{ id: 'path-heir', name: '旅店继承人' }], startFactions: [{ id: 'guild', name: '行会' }] },
          },
        });
      }
      return JSON.stringify({
        content: {
          npcs: [npc('n1', '沈晚晴', { home: '旅店前厅', pathId: 'path-heir', metStart: true })],
          rooms,
          startRoom: 'lobby',
          locations: [{ id: 'lobby', name: '旅店前厅' }],
          fixedEvents: [{
            id: 'fx_1', name: '开店', trigger: { kind: 'auto' }, openingPrompt: true,
            prompt: '清晨的旅店第一次开门，海风灌进前厅，账本摊在柜台上等你签字。',
            effects: [{ kind: 'stat', key: 'insight', delta: 2 }, { kind: 'metric', key: 'fame', delta: 3 }],
          }],
          storylines: [{ id: 'main', name: '主线', nodes: [{ id: 'n1', name: '接手', desc: '熟悉账本', conds: [] }] }],
        },
      });
    },
  });
  assert.equal(result.progress.failedCount, 0, JSON.stringify(result.progress.modules.filter((m) => m.error)));
  assert.equal(prompts.length, 3, '基础设定 → 人物与地点 → 事件与剧情线');
  const phase2 = prompts[1];
  assert.ok(prompts[2].includes(tone), '第3次同样带完整剧本基调');
  assert.match(prompts[2], /lobby|旅店前厅/, '第3次须带第2次的地点上下文');
  assert.ok(phase2.includes(tone), '第2次必须收到完整第1次剧本基调');
  assert.match(phase2, /insight=洞察/);
  assert.match(phase2, /charm=魅力/);
  assert.match(phase2, /moneyLabel：元/);
  assert.match(phase2, /wb1=雾港潮汐/);
  assert.match(phase2, /guild=行会|势力：无/);
  assert.match(phase2, /path-heir=旅店继承人/);
  assert.match(phase2, /开局日期：2019\.09\.01/);
  const c = result.mod.content;
  // 功能注释：第 1 次写的假挂靠 x/y 被剥掉；第 2 次按正文提到的「后厨」只回填有效 room id
  assert.deepEqual(c.worldBook[0].bindRooms, ['kitchen']);
  assert.equal(c.worldBook[0].bindNpcs, undefined);
  // 功能注释：设定无组织 → 势力名单被剥掉
  assert.equal(c.creation.startFactions, undefined);
  assert.equal(c.locations, undefined);
  assert.equal(c.npcs[0].home, 'lobby');
  assert.equal('metStart' in c.npcs[0], false, '设定没有恋爱就不写 metStart');
  assert.equal(c.creation.paths[0].hero, 'n1');
  assert.equal(c.creation.paths[0].room, 'lobby');
  assert.deepEqual(c.fixedEvents[0].effects.map((e) => e.key), ['c:insight']);
  assert.equal(c.fixedEvents[0].openingPrompt, true);
  assert.doesNotMatch(JSON.stringify(c.storylines), /fame/);
});

test('progress文案_如实反映开场与固定事件_无支线_无开场已下架', async () => {
  const detail = await load('lib/worldGenProgressDetail.ts');
  const summary = detail.worldGenStepResultSummary('fixedEvents', {
    fixedEvents: [
      { id: 'fx_1', name: '开店', openingPrompt: true },
      { id: 'fx_2', name: '打烊' },
    ],
    opening: { paragraphs: ['清晨的海风。', '旅店开门了。'] },
  });
  assert.match(summary, /固定事件 2 条/);
  assert.match(summary, /开局提示词 1 条/);
  assert.match(summary, /开场白 2 段/);
  const story = detail.worldGenStepResultSummary('storylines', { storylines: [{ id: 'm' }], endings: [{ id: 'e' }] });
  assert.doesNotMatch(story, /支线/);
  assert.match(story, /主线 1/);
  assert.deepEqual(detail.WORLD_GEN_STEP_FACETS.fixedEvents.includes('开局提示词'), true);
  assert.equal(detail.WORLD_GEN_STEP_FACETS.storylines.includes('支线'), false);
  const limits = detail.worldGenLeanLimits(11);
  assert.equal('scriptToneChars' in limits, false);
  const { readFileSync } = await import('node:fs');
  for (const f of ['lib/worldGenProgressDetail.ts', 'lib/worldGenGenerate.ts', 'components/WorldGenWizard.tsx']) {
    assert.doesNotMatch(readFileSync(join(romance, f), 'utf8'), /开场已下架/);
  }
});
