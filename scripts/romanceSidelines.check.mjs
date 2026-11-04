/**
 * 剧情线：「主线与目标」「结局与时限」合并为一个「剧情线」页（主线 / 支线 / 结局三栏）+ 新增支线。
 * 支线判定为纯函数（Romance/src/lib/sidelines.ts），只写 side:* 进度，不碰主线 quest:*。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');
const mod = await import(pathToFileURL(join(romance, 'lib/sidelines.ts')).href);
const { applySidelines, normalizeSidelines, visibleSidelines, sidelineBrief, sideState } = mod;
const wizard = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

/** 测试用条件求值：只认 flag 条件（≥），足够覆盖触发 / 完成 / 失败分支 */
const evalCond = (c, s) => c.kind === 'flag' && (s.flags?.[c.key] ?? 0) >= c.value;
const deps = {
  evalCond,
  condsMet: (conds, s, match = 'all') => !conds?.length || (match === 'any' ? conds.some((c) => evalCond(c, s)) : conds.every((c) => evalCond(c, s))),
  applyEffects: (s, effects) => {
    const flags = { ...(s.flags ?? {}) };
    const changes = [];
    for (const e of effects ?? []) if (e.kind === 'flag') { flags[e.key] = (flags[e.key] ?? 0) + e.delta; changes.push(`${e.key}+${e.delta}`); }
    return { next: { ...s, flags }, changes };
  },
};
const f = (key, value = 1) => ({ kind: 'flag', key, op: '>=', value });
const gift = (key, delta = 10) => ({ kind: 'flag', key, delta });

test('normalizeSidelines_旧作品无支线_视为空数组', () => {
  assert.deepEqual(normalizeSidelines(undefined), []);
  assert.deepEqual(normalizeSidelines({ a: 1 }), []);
  const out = normalizeSidelines([{ name: '无 id' }, { id: ' s1 ', name: '寻猫', limitDays: '3', trigger: [] }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 's1');
  assert.equal(out[0].limitDays, 3);
  assert.equal(out[0].trigger, undefined);
});

test('applySidelines_触发未满足_支线不出现', () => {
  const lines = [{ id: 's1', name: '寻猫', trigger: [f('metCat')], conds: [f('foundCat')] }];
  const { next, changes } = applySidelines({ day: 1, flags: {} }, lines, deps);
  assert.equal(sideState('s1', next), 'pending');
  assert.deepEqual(changes, []);
});

test('applySidelines_完成_发奖励并记已完成_不写主线进度', () => {
  const lines = [{ id: 's1', name: '寻猫', trigger: [f('metCat')], conds: [f('foundCat')], rewards: [gift('money', 50)], unlockIds: ['ev_cat'] }];
  let s = { day: 1, flags: { metCat: 1, 'quest:main': 0 } };
  ({ next: s } = applySidelines(s, lines, deps));
  assert.equal(sideState('s1', s), 'active');
  s = { ...s, flags: { ...s.flags, foundCat: 1 } };
  const r = applySidelines(s, lines, deps);
  assert.equal(sideState('s1', r.next), 'done');
  assert.equal(r.next.flags['sideDone:s1'], 1);
  assert.equal(r.next.flags.money, 50);
  assert.deepEqual(r.next.eventsUnlocked, ['ev_cat']);
  assert.equal(r.next.flags['quest:main'], 0);
  assert.match(r.changes.join(), /支线「寻猫」完成：money\+50/);
  // 只触发一次：完成后再结算不重复发奖
  const again = applySidelines(r.next, lines, deps);
  assert.equal(again.next.flags.money, 50);
  assert.deepEqual(again.changes, []);
});

test('applySidelines_失败_给安慰奖且不中断主线', () => {
  const lines = [{ id: 's2', name: '护送', failConds: [f('npcGone')], conds: [f('arrived')], rewards: [gift('money', 99)], failRewards: [gift('comfort', 1)] }];
  const s = { day: 2, flags: { 'side:s2': 2, npcGone: 1, arrived: 1, 'quest:main': 1, 'quest:n1': 1 } };
  const { next, changes } = applySidelines(s, lines, deps);
  assert.equal(sideState('s2', next), 'failed');
  assert.equal(next.flags.comfort, 1);
  assert.equal(next.flags.money, undefined, '失败优先，不得发完成奖励');
  assert.equal(next.flags['quest:main'], 1);
  assert.equal(next.flags['quest:n1'], 1);
  assert.ok(!Object.keys(next.flags).some((k) => k.startsWith('quest:') && next.flags[k] < 0));
  assert.match(changes.join(), /支线「护送」失败/);
});

test('applySidelines_限时到期_判超时失败', () => {
  const lines = [{ id: 's3', name: '限时', limitDays: 3, conds: [f('never')] }];
  const before = applySidelines({ day: 4, flags: { 'side:s3': 2, 'sideAt:s3': 2 } }, lines, deps);
  assert.equal(sideState('s3', before.next), 'active');
  const after = applySidelines({ day: 5, flags: { 'side:s3': 2, 'sideAt:s3': 2 } }, lines, deps);
  assert.equal(sideState('s3', after.next), 'failed');
  assert.match(after.changes.join(), /超时/);
});

test('applySidelines_未配置失败_只会完成或一直进行中', () => {
  const lines = [{ id: 's4', name: '开放', conds: [f('x')] }];
  const r = applySidelines({ day: 999, flags: { 'side:s4': 2, 'sideAt:s4': 0 } }, lines, deps);
  assert.equal(sideState('s4', r.next), 'active');
});

test('applySidelines_可重复支线_完成后回到未出现可再次触发', () => {
  const lines = [{ id: 'r1', name: '打工', repeat: true, trigger: [f('open')], conds: [f('work')], rewards: [gift('money', 5)] }];
  let s = { day: 1, flags: { open: 1, work: 1 } };
  ({ next: s } = applySidelines(s, lines, deps));
  assert.equal(s.flags['side:r1'], 0);
  assert.equal(s.flags['sideDone:r1'], 1);
  assert.equal(sideState('r1', s), 'done');
  ({ next: s } = applySidelines(s, lines, deps));
  assert.equal(s.flags['sideDone:r1'], 2);
  assert.equal(s.flags.money, 10);
});

test('applySidelines_停用支线_不结算', () => {
  const lines = [{ id: 'off', name: '停用', enabled: false, conds: [f('x')] }];
  const r = applySidelines({ day: 1, flags: { x: 1 } }, lines, deps);
  assert.equal(r.next.flags['side:off'], undefined);
});

test('visibleSidelines_隐藏支线触发前不显示_非隐藏显示未出现', () => {
  const lines = [{ id: 'h', name: '隐藏', hidden: true }, { id: 'v', name: '公开' }];
  assert.deepEqual(visibleSidelines(lines, { flags: {} }).map((x) => [x.line.id, x.state]), [['v', 'pending']]);
  assert.deepEqual(visibleSidelines(lines, { flags: { 'side:h': 2 } }).map((x) => x.line.id), ['h', 'v']);
});

test('sidelineBrief_只报进行中的支线', () => {
  const lines = [{ id: 'a', name: '甲', desc: '找钥匙' }, { id: 'b', name: '乙' }];
  const brief = sidelineBrief(lines, { flags: { 'side:a': 2, 'side:b': 1 } });
  assert.match(brief, /支线·甲】进行中——找钥匙/);
  assert.doesNotMatch(brief, /乙/);
  assert.equal(sidelineBrief(undefined, { flags: {} }), '');
});

test('ModEditorPanel_剧情线一页纵向合并_不再拆主线与目标和结局与时限', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /title="剧情线"/);
  assert.doesNotMatch(panel, /title="主线与目标"/);
  assert.doesNotMatch(panel, /title="结局与时限"/);
  assert.doesNotMatch(panel, /title="经济收官"/);
  assert.match(panel, /<PlotLinesTabs[\s\S]*?main=\{<StorylinesEditor[\s\S]*?side=\{<SidelinesEditor[\s\S]*?end=\{[\s\S]*?<EndingsPanel[\s\S]*?sidelinesValue=\{c\.sidelines\}/);
  const tabs = read('components/PlotLinesTabs.tsx');
  for (const label of ['"主线"', '"支线"', '"结局"']) assert.ok(tabs.includes(label), label);
  // 功能注释：同页纵向展示，不再用互斥 tab 把主线/结局拆成看不见的另一页
  assert.doesNotMatch(tabs, /role="tablist"/);
  assert.match(tabs, /space-y-5/);
});

test('SidelinesEditor_复用条件与奖励组件_空状态文案', () => {
  const ed = read('components/SidelinesEditor.tsx');
  assert.match(ed, /还没有支线。点「新建支线」添加/);
  assert.match(ed, /\bCondRow\b/);
  assert.match(ed, /\bEffectRow\b/);
  assert.match(ed, /\bEventPicks\b/);
  assert.match(ed, /useConfirm/);
  assert.match(ed, /aria-expanded=\{open\}/);
  assert.doesNotMatch(ed, /window\.confirm|\balert\(/);
});

test('剧情条件编辑器_使用当前作品草稿的主线和支线_不回退当前世界', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /<FixedEventsPanel[^>]*storylines=\{c\.storylines\}[^>]*sidelines=\{c\.sidelines\}/);
  assert.match(panel, /<StorylinesEditor[^>]*sidelines=\{c\.sidelines\}/);
  const events = read('components/FixedEventsPanel.tsx');
  assert.match(events, /<option value="side">支线进度<\/option>/);
  assert.match(events, /<CondRow[^>]*quests=\{quests\} sides=\{sides\}/);
  assert.match(events, /<CondLogic[^>]*quests=\{quests\} sides=\{sides\}/);
  const main = read('components/StorylinesEditor.tsx');
  assert.match(main, /<CondRow[^>]*quests=\{quests\} sides=\{sides\}/);
});

test('发布审计和模组校验_覆盖支线及其失效引用', () => {
  const audit = read('game/refAudit.ts');
  assert.match(audit, /export type RefKind = [^;]*"side"/);
  assert.match(audit, /case "side": out\.push\(\{ kind: "side"/);
  assert.match(audit, /for \(const s of sidelines\)/);
  assert.match(audit, /支线 ID.*重复/);
  assert.match(audit, /side: new Set\(sidelines\.map/);
  const registry = read('mods/registry.ts');
  assert.match(registry, /\["npcs", "items", "gigs", "events", "fixedEvents", "storylines", "sidelines"/);
  const nmod = read('mods/nmod.ts');
  assert.match(nmod, /n\(c\.sidelines\) && `支线/);
  assert.match(nmod, /add\("支线", c\.sidelines\)/);
  assert.match(nmod, /sidelines: c\.sidelines \?\? \[\]/);
});

test('AI生成向导_主线支线结局合并为单一剧情线步骤_旧结局步骤自动迁移', () => {
  const steps = wizard.WORLD_GEN_EDITOR_STEPS;
  const plot = steps.filter((x) => x.id === 'storylines');
  assert.equal(plot.length, 1);
  assert.equal(plot[0].name, '剧情线');
  assert.equal(steps.some((x) => x.id === 'endings'), false);
  const normalized = wizard.normalizeWorldGenStep1({
    worldTitle: '测试',
    worldSetting: '测试设定',
    engineId: 'balanced',
    editorStepIds: ['endings'],
    contentIds: [],
  });
  assert.deepEqual(normalized.editorStepIds, ['storylines']);
  const gen = read('lib/worldGenGenerate.ts');
  assert.match(gen, /禁止写 sidelines/);
  assert.match(gen, /normalizeWorldGenStorylinesPatch/);
});

test('引擎接线_日结在主线之后结算支线_条件可读支线_AI读sim进度', () => {
  const logic = read('game/logic.ts');
  assert.ok(logic.indexOf('applyStorylines(n') < logic.indexOf('applySidelines(n'), '支线须在主线之后');
  assert.match(read('game/fixedEvents.ts'), /case "side":\s*return sideState\(c\.key, s\) === c\.state/);
  const ai = read('lib/ai.ts');
  assert.match(ai, /storylineBrief\(state\.sim\)/);
  assert.match(ai, /sidelineBrief\(getWorldSidelines\(\), state\.sim\)/);
  assert.doesNotMatch(ai, /storylineBrief\(state as unknown/);
  assert.match(read('mods/registry.ts'), /sidelines: normalizeSidelines\(/);
});

test('人物线路空状态文案未改动', () => {
  const hits = ['components/ModEditorPanel.tsx', 'components/EndingsPanel.tsx', 'components/FixedEventsPanel.tsx']
    .some((p) => read(p).includes('本作品还没有自定义属性或人物线路词条'));
  assert.ok(hits, '原文案须保留');
});
