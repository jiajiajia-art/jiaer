/**
 * 世界生成契约（R1–R10 / R2）：条数建议、基调 5000、完整上下文、无 locations、无 fame 默认。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('scriptTone_上限5000且UI同步', async () => {
  const lim = await import(pathToFileURL(join(romance, 'lib/modBasicInfoLimits.ts')).href);
  assert.equal(lim.SCRIPT_TONE_MAX, 5000);
  const panel = read('components/ModEditorPanel.tsx');
  assert.doesNotMatch(panel, /超出 4000/);
  assert.match(panel, /5000/);
});

test('worldGen_条数建议_软校验接受2人3地', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const detail = await import(pathToFileURL(join(romance, 'lib/worldGenProgressDetail.ts')).href);
  assert.equal(detail.WORLD_GEN_NPCS_SUGGEST_MIN, 2);
  assert.equal(detail.WORLD_GEN_ROOMS_SUGGEST_MIN, 3);
  const rooms = {
    room1: { name: '旅店前厅', desc: '木地板与海风。' },
    room2: { name: '后厨', desc: '锅铲声不断。' },
    room3: { name: '阁楼', desc: '旧箱子堆着。' },
  };
  const npcs = [
    {
      id: 'n1',
      name: '沈晚晴',
      gender: '女',
      age: 24,
      home: 'room1',
      bio: '这是一段超过二十字的人物小传，用来通过软校验。',
    },
    {
      id: 'n2',
      name: '林夏',
      gender: '女',
      age: 22,
      home: 'room2',
      bio: '这是一段超过二十字的人物小传，用来通过软校验。',
    },
  ];
  assert.equal(
    gen.softValidateBatchPatch(['npcs', 'rooms'], { npcs, rooms, startRoom: 'room1' }),
    null,
  );
  const lean = detail.worldGenLeanPromptBlock(detail.worldGenLeanLimits(9), 'skeleton');
  // 功能注释：允许在「禁止约 700 字」禁令里出现该短语，但不得再写成目标字数
  assert.match(lean, /禁止「约 700 字」/);
  assert.doesNotMatch(lean, /scriptTone 约 700/);
  assert.doesNotMatch(lean, /人物恰好 \d+ 名/);
  assert.match(lean, /不要写 locations\[\]/);
});

test('buildGeneratedContext_含属性货币世界书完整基调', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const tone = `${'口吻与时代设定。'.repeat(80)}必须遵守潮汐与账本。`;
  assert.ok(tone.length > 600);
  const ctx = gen.buildGeneratedContext({
    id: 'w1',
    name: '雾港来信',
    kind: 'world',
    version: '1',
    description: '简介',
    content: {
      prompt: { scriptTone: tone },
      customAttrs: [{ id: 'insight', label: '洞察', desc: '察言观色' }],
      moneyLabel: '元',
      startMoney: 3000,
      worldBook: [{ id: 'wb1', title: '潮汐' }],
      creation: { paths: [{ id: 'p1', name: '继承人' }], startFactions: [] },
      startDate: '2024.03.15',
    },
  });
  assert.match(ctx, /洞察/);
  assert.match(ctx, /moneyLabel：元/);
  assert.match(ctx, /世界书：wb1=潮汐/);
  assert.match(ctx, /势力：无/);
  assert.match(ctx, /人物线路：p1=继承人/);
  assert.match(ctx, /开局日期：2024\.03\.15/);
  assert.ok(ctx.includes(tone), '第2次须带完整剧本基调，不得截成600字');
  assert.doesNotMatch(ctx, /剧本基调：.{0,20}\.\.\./);
});

test('storylines_不再自动补fame条件', async () => {
  const story = await import(pathToFileURL(join(romance, 'lib/worldGenStorylines.ts')).href);
  const nodes = story.normalizeWorldGenQuestNodes([
    { id: 'n1', name: '接手', desc: '熟悉账本', conds: [] },
  ]);
  assert.equal(nodes.length, 1);
  assert.deepEqual(nodes[0].conds, []);
  assert.doesNotMatch(JSON.stringify(nodes), /fame/);
});

test('sanitize_剥掉locations数组', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const out = gen.sanitizeWorldGenBatchPatch(['rooms'], {
    rooms: { room1: { name: '前厅', desc: '海风' } },
    startRoom: 'room1',
    locations: [{ id: 'room1', name: '前厅' }],
  });
  assert.equal('locations' in out, false);
  assert.equal(out.rooms.room1.name, '前厅');
});

test('editor_无LIVE人物回落', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.doesNotMatch(panel, /npcs\.length \? npcs : LIVE_PEOPLE/);
  assert.doesNotMatch(panel, /import \{[^}]*LIVE_PEOPLE/);
  assert.doesNotMatch(panel, /\(npcs\.length \? npcs : LIVE_PEOPLE\)/);
  const ai = read('components/AiEventWriter.tsx');
  assert.doesNotMatch(ai, /LIVE_PEOPLE|LIVE_LOCATIONS/);
});
