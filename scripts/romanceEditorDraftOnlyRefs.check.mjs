/**
 * R0 / R14 / R17：模组编辑器下拉、默认值、引用审计只读「当前表单」，
 * 表单为空时保持为空，绝不回退内置娱乐圈（LIVE_PEOPLE / LIVE_LOCATIONS / LIVE_ITEMS / star2005）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');
/** 功能注释：去掉注释再断言，避免「禁止回退 LIVE_PEOPLE」这类说明文字误伤 */
const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// 功能注释：refAudit 依赖 registry / yaml?raw，借 esbuild 打成临时 ESM 再真跑
async function loadRefAudit() {
  const rawPlugin = {
    name: 'raw',
    setup(b) {
      b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
      b.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => ({ contents: await readFile(a.path, 'utf8'), loader: 'text' }));
    },
  };
  const outfile = join(tmpdir(), `refAudit.draftOnly.${process.pid}.mjs`);
  await build({
    entryPoints: [join(romance, 'game/refAudit.ts')],
    bundle: true, format: 'esm', platform: 'node', outfile, plugins: [rawPlugin], logLevel: 'error',
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  });
  return import(pathToFileURL(outfile).href);
}

const ENT = { npc: 'linyi', room: 'apartment', item: 'schedulebook' };
const refEvent = (over = {}) => ({
  id: 'fx1', name: '事件', prompt: '提示词',
  conds: [{ kind: 'rel', key: ENT.npc, op: 'gte', value: 1 }, { kind: 'location', key: ENT.room }, { kind: 'item', key: ENT.item }],
  effects: [{ kind: 'rel', key: ENT.npc, delta: 3 }, { kind: 'addItem', key: ENT.item }, { kind: 'unlockLocation', key: ENT.room }],
  ...over,
});
const texts = (r) => r.issues.filter((i) => i.level === 'error').map((i) => i.text);

test('auditStory_草稿空表单_引用娱乐圈同名id也报引用了不存在', async () => {
  const { auditStory } = await loadRefAudit();
  // 对照：表单里有这些 id 时不报「不存在」（内置娱乐圈世界已清空人物 / 物品，不能再拿它当对照）
  const present = auditStory({ events: [refEvent()], npcIds: [ENT.npc], roomIds: [ENT.room], itemIds: [ENT.item], skip: ['flag'] });
  assert.equal(texts(present).filter((t) => t.includes('不存在')).length, 0, '表单里有的 id 不应报错');
  // 草稿口径：传入空数组也是权威，不并入 LIVE_*
  const draft = auditStory({ events: [refEvent()], npcIds: [], roomIds: [], itemIds: [], skip: ['flag'] });
  const errs = texts(draft);
  assert.ok(errs.some((t) => t.includes(`引用了不存在的人物「${ENT.npc}」`)), errs.join('|'));
  assert.ok(errs.some((t) => t.includes(`引用了不存在的地点「${ENT.room}」`)), errs.join('|'));
  assert.ok(errs.some((t) => t.includes(`引用了不存在的物品「${ENT.item}」`)), errs.join('|'));
});

test('auditStory_只传npcIds空数组_即视为草稿_不并入LIVE_PEOPLE', async () => {
  const { auditStory, isDraftAudit } = await loadRefAudit();
  assert.equal(isDraftAudit({ npcIds: [] }), true);
  assert.equal(isDraftAudit({ roomIds: [] }), true);
  assert.equal(isDraftAudit({}), false);
  assert.equal(isDraftAudit({ draft: false, npcIds: ['a'] }), false);
  const r = auditStory({ events: [refEvent({ conds: [{ kind: 'rel', key: ENT.npc, op: 'gte', value: 1 }], effects: [] })], npcIds: [], skip: ['flag', 'location', 'item'] });
  assert.ok(texts(r).some((t) => t.includes(`人物「${ENT.npc}」`)));
});

test('auditStory_草稿_本作品有的id通过_固定事件与主线节点都校验人物地点物品', async () => {
  const { auditStory } = await loadRefAudit();
  const ok = auditStory({
    events: [refEvent({ conds: [{ kind: 'rel', key: 'hero', op: 'gte', value: 1 }, { kind: 'location', key: 'inn' }, { kind: 'item', key: 'key' }], effects: [{ kind: 'addItem', key: 'key' }] })],
    npcIds: ['hero'], roomIds: ['inn'], itemIds: ['key'], skip: ['flag'],
  });
  assert.equal(texts(ok).filter((t) => t.includes('不存在')).length, 0, texts(ok).join('|'));

  // 主线节点：条件里引用别处的人物/地点/物品必须报错（不再 skip）
  const quest = auditStory({
    storylines: [{ id: 'q1', name: '主线', nodes: [{ id: 'n1', name: '节点', desc: '', conds: [{ kind: 'rel', key: ENT.npc, op: 'gte', value: 1 }, { kind: 'location', key: ENT.room }, { kind: 'item', key: ENT.item }] }] }],
    npcIds: ['hero'], roomIds: ['inn'], itemIds: [], skip: ['flag'],
  });
  const errs = texts(quest);
  assert.ok(errs.some((t) => t.includes('人物')) && errs.some((t) => t.includes('地点')) && errs.some((t) => t.includes('物品')), errs.join('|'));
});

test('auditStory_草稿_缺itemIds按空集合_不用LIVE_ITEMS放行', async () => {
  const { auditStory } = await loadRefAudit();
  const r = auditStory({ events: [refEvent({ conds: [{ kind: 'item', key: ENT.item }], effects: [] })], npcIds: [], roomIds: [], skip: ['flag'] });
  assert.ok(texts(r).some((t) => t.includes(`物品「${ENT.item}」`)));
});

test('auditStory_草稿_缺主线支线不借当前世界的_世界书绑定仍按传入id校验', async () => {
  const { auditStory } = await loadRefAudit();
  const r = auditStory({
    worldBook: [{ id: 'w1', title: '条目', keywords: ['x'], content: '正文', enabled: true, bindRooms: [ENT.room], bindNpcs: [ENT.npc] }],
    npcIds: [], roomIds: [], itemIds: [],
  });
  const errs = texts(r);
  assert.ok(errs.some((t) => t.includes(`绑定的地点「${ENT.room}」已不存在`)));
  assert.ok(errs.some((t) => t.includes(`绑定的角色「${ENT.npc}」已不存在`)));
});

test('refAudit源码_传入npcIds时不与LIVE_合并_草稿路径有明确开关', () => {
  const src = code('game/refAudit.ts');
  assert.match(src, /export function isDraftAudit/);
  assert.match(src, /draft\?: boolean/);
  assert.doesNotMatch(src, /new Set\(\[\.\.\.\(inp\.npcIds \?\? \[\]\), \.\.\.LIVE_PEOPLE/, '草稿路径不得无条件并入 LIVE_PEOPLE');
  assert.doesNotMatch(src, /item: new Set\(LIVE_ITEMS/, '物品集合必须区分草稿');
  assert.match(src, /draft \? \(inp\.npcIds \?\? \[\]\)/);
  assert.match(src, /draft \? \(inp\.itemIds \?\? \[\]\)|draft \? \(inp\.itemIds/);
  assert.match(src, /auditStory\(\{ draft: false/, 'auditGame（存档）显式非草稿');
});

test('draftRefs_空表单默认值为空_有属性才预选首个自定义属性', async () => {
  const { draftRefDefaults, buildDraftRefs, EMPTY_DRAFT_REFS } = await import(pathToFileURL(join(romance, 'lib/draftRefs.ts')).href);
  const d = draftRefDefaults(EMPTY_DRAFT_REFS);
  assert.deepEqual(d, { rel: '', relSet: [], location: '', item: '', faction: '', metric: '', stat: '' });
  const refs = buildDraftRefs({
    npcs: [{ id: 'hero', name: '主角' }],
    rooms: { inn: { name: '客栈', items: [{ id: 'key', name: '钥匙' }] } },
    items: [{ id: 'key', name: '钥匙' }, { id: 'map', name: '地图' }],
    attrs: [{ id: 'courage', label: '勇气' }],
  });
  assert.deepEqual(refs.items.map((i) => i.id), ['key', 'map']);
  const d2 = draftRefDefaults(refs);
  assert.equal(d2.metric, 'c:courage');
  assert.equal(d2.rel, 'hero');
  assert.equal(d2.location, 'inn');
  assert.equal(d2.item, 'key');
  const none = draftRefDefaults(buildDraftRefs({ npcs: [], rooms: {}, attrs: [] }));
  assert.equal(none.metric, '', '没有自定义属性不得自动填指标');
});

test('gameRulePresets_只提供本作品属性齐全的预设', async () => {
  const { GAME_RULE_PRESETS, availableRulePresets, workMetricKeys } = await import(pathToFileURL(join(romance, 'lib/gameRulePresets.ts')).href);
  assert.deepEqual(availableRulePresets(GAME_RULE_PRESETS, []), [], '空作品不提供任何预设');
  assert.equal(availableRulePresets(GAME_RULE_PRESETS, undefined).length, GAME_RULE_PRESETS.length, '不传 = 不过滤');
  const names = availableRulePresets(GAME_RULE_PRESETS, ['money']).map((p) => p.name);
  assert.deepEqual(names, ['幸运日']);
  assert.deepEqual(workMetricKeys({}), []);
  assert.deepEqual(workMetricKeys({ attrs: [{ id: 'hp' }], metaLabels: { fame: '声望', stress: '' }, startMoney: 0 }).sort(), ['c:hp', 'fame', 'money']);
  for (const p of GAME_RULE_PRESETS) assert.ok(Array.isArray(p.requires) && p.requires.length > 0, `${p.name} 缺 requires`);
});

test('ModEditorPanel_不再用LIVE_PEOPLE兜底人物下拉_并提供草稿引用池', () => {
  const raw = read('components/ModEditorPanel.tsx');
  assert.doesNotMatch(raw, /npcs\.length \? npcs : LIVE_PEOPLE/);
  assert.doesNotMatch(code('components/ModEditorPanel.tsx'), /\bLIVE_(PEOPLE|LOCATIONS|ITEMS)\b/);
  assert.match(raw, /DraftRefsContext\.Provider/);
  assert.match(raw, /buildDraftRefs\(/);
  assert.match(raw, /metricKeys=\{draftRefs\.metricKeys\}/, '规则预设按本作品属性过滤');
});

test('ModPathsEditor_编辑器不含LIVE_兜底_游玩态面板拆到PathUnlockPanel', () => {
  const src = code('components/ModPathsEditor.tsx');
  assert.doesNotMatch(src, /\bLIVE_(PEOPLE|LOCATIONS|ITEMS)\b/);
  assert.doesNotMatch(src, /liveEvents\(\)/);
  assert.doesNotMatch(src, /export function PathUnlockPanel/);
  assert.match(read('components/PathUnlockPanel.tsx'), /export function PathUnlockPanel/);
  assert.match(read('components/GameShell.tsx'), /from "\.\/PathUnlockPanel"/);
});

test('FixedEventsPanel_草稿下条件效果下拉只读draftRefs_审计不再skip人物地点物品', () => {
  const src = code('components/FixedEventsPanel.tsx');
  assert.match(src, /draftRefs \? draftRefs\.rooms/);
  assert.match(src, /draftRefs \? draftRefs\.items/);
  assert.match(src, /draftRefs \? draftRefs\.people|draftRefs\?\.people/);
  assert.match(src, /defaultCond\((?:e\.target\.value as FixedCond\["kind"\]|k), draftRefs\)/);
  assert.match(src, /defaultEffect\((?:e\.target\.value as FixedEffect\["kind"\]|k), draftRefs\)/);
  assert.match(src, /draft: true, events/);
  assert.doesNotMatch(src, /skip: \["item", "location", "npc", "flag"\]/);
  assert.match(src, /itemIds: draftItems\.map/);
});

test('编辑器审计调用点_世界书固定事件主线结局都传当前表单id', () => {
  assert.match(code('components/ModWorldBookEditor.tsx'), /auditStory\(\{ draft: true, worldBook: list, npcIds: npcs\.map/);
  assert.doesNotMatch(code('components/ModWorldBookEditor.tsx'), /skip: \[\.\.\.\(npcs\.length/);
  const story = code('components/StorylinesEditor.tsx');
  assert.match(story, /draft: true, storylines: list/);
  assert.doesNotMatch(story, /skip: \["item", "location", "npc", "flag"\]/);
  const end = code('components/EndingsPanel.tsx');
  assert.match(end, /draft: true, endings: list/);
  assert.match(end, /roomIds: \(draftRefs\?\.rooms/);
  assert.doesNotMatch(end, /skip: \["item", "location", "flag"/);
  const nmod = code('mods/nmod.ts');
  assert.match(nmod, /m\.kind === "world"\s*\?\s*auditStory\(\{ draft: true/);
});

test('AiEventWriter_上下文为空时不回落LIVE_也不带娱乐圈词', async () => {
  const src = code('components/AiEventWriter.tsx');
  assert.doesNotMatch(src, /\bLIVE_[A-Z]+\b/);
  assert.doesNotMatch(src, /FIXED_METRICS|STAT_ORDER|STAT_LABELS/);
  assert.doesNotMatch(src, /\?\s*extra\.(rooms|npcs)\s*:\s*LIVE/);
  assert.match(src, /rooms: extra\?\.rooms \?\? \[\]/);
  assert.match(src, /npcs: extra\?\.npcs \?\? \[\]/);
  const { buildAiFixedEventsSystemPrompt } = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  const prompt = buildAiFixedEventsSystemPrompt({ rooms: [], npcs: [], metrics: [], stats: [], worldBook: [] }, []);
  assert.match(prompt, /人物：（无）/);
  assert.match(prompt, /地点：（无）/);
  assert.doesNotMatch(prompt, /天光小区|启星事务所|浮光|林屹|apartment|linyi/);
});

test('新建条件效果默认值与规则预设_走本作品引用池', () => {
  const panel = code('components/FixedEventsPanel.tsx');
  assert.match(panel, /export function defaultCond\(kind: FixedCond\["kind"\], refs\?: DraftRefs \| null\)/);
  assert.match(panel, /export function defaultEffect\(kind: FixedEffect\["kind"\], refs\?: DraftRefs \| null\)/);
  assert.match(panel, /export function useDraftDefaults\(\)/);
  for (const f of ['StorylinesEditor', 'SidelinesEditor', 'LookRulesEditor', 'EventAdvanced', 'GameRulesEditor']) {
    const s = code(`components/${f}.tsx`);
    assert.doesNotMatch(s, /\bdefaultCond\(|\bdefaultEffect\(/, `${f} 仍直接调用无引用池的 defaultCond/defaultEffect`);
    assert.match(s, /useDraftDefaults\(\)/, `${f} 应使用 useDraftDefaults`);
  }
  assert.match(code('components/GameRulesEditor.tsx'), /availableRulePresets\(GAME_RULE_PRESETS, metricKeys\)/);
  assert.match(code('components/EventAdvanced.tsx'), /draftRefs \? draftRefs\.rooms/);
});

test('视角文案_题材中性_编辑器帮助文案不举片场例子', () => {
  assert.doesNotMatch(read('components/PlayPrefsPicker.tsx'), /走进片场/);
  assert.match(read('components/PlayPrefsPicker.tsx'), /走进场景/);
  assert.doesNotMatch(read('components/EventAdvanced.tsx'), /去片场/);
  assert.doesNotMatch(read('components/AiEventWriter.tsx'), /改到片场/);
});
