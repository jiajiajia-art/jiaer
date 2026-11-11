/**
 * 玩法规则：缺 branches 不崩；预设写入事件库并挂钩；列表默认单行；高压计数标规则变量。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('normalizeRuleBranches_缺分支或单条对象都收成数组', async () => {
  const { normalizeRuleBranches } = await import(pathToFileURL(join(romance, 'lib/gameRuleShape.ts')).href);
  assert.deepEqual(normalizeRuleBranches(undefined), []);
  assert.equal(normalizeRuleBranches({ conds: [{ kind: 'metric' }], effects: [{ kind: 'metric' }] }).length, 1);
  const wrapped = normalizeRuleBranches({ list: [{ conds: [], effects: [{ kind: 'flag' }] }] });
  assert.deepEqual(wrapped[0].effects, [{ kind: 'flag' }]);
  assert.deepEqual(normalizeRuleBranches([{ notice: '热度' }])[0].conds, []);
  assert.equal(normalizeRuleBranches([{ eventId: 'ev_1', effects: [] }])[0].eventId, 'ev_1');
});

test('sanitizeModStrings_opening字符串或数组须收成对象', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const fromStr = sanitizeModStrings({
    id: 'o1', name: '开场', version: '1.0.0', kind: 'world',
    content: { opening: '一段开场白' },
  });
  assert.deepEqual(fromStr.content.opening, { paragraphs: ['一段开场白'] });
  const fromArr = sanitizeModStrings({
    id: 'o2', name: '开场', version: '1.0.0', kind: 'world',
    content: { opening: ['甲', '乙'] },
  });
  assert.deepEqual(fromArr.content.opening, { paragraphs: ['甲', '乙'] });
});

test('sanitizeModStrings_玩法规则缺branches须补成空数组', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const clean = sanitizeModStrings({
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      gameRules: [
        { id: 'r1', name: '过劳', when: 'day' },
        { id: 'r2', name: '单支', when: 'week', branches: { conds: [{ kind: 'metric', key: 'energy' }], effects: [{ kind: 'metric', key: 'stress', delta: 1 }] } },
      ],
    },
  });
  assert.deepEqual(clean.content.gameRules[0].branches, []);
  assert.equal(clean.content.gameRules[1].branches.length, 1);
  assert.equal(Array.isArray(clean.content.gameRules[1].branches[0].conds), true);
  assert.equal(clean.content.gameRules[1].branches[0].effects[0].key, 'stress');
  const editor = readFileSync(join(romance, 'components/GameRulesEditor.tsx'), 'utf8');
  assert.match(editor, /normalizeRuleBranches\(raw\.branches\)/);
  assert.doesNotMatch(editor, /r\.branches\.map/);
});

test('gameRulePresets_过劳与幸运日写入事件库且规则名正确_高压计数为规则变量', async () => {
  const { GAME_RULE_PRESETS, materializeRulePreset, linkedLibraryEventNames } = await import(
    pathToFileURL(join(romance, 'lib/gameRulePresets.ts')).href
  );
  const names = GAME_RULE_PRESETS.map((p) => p.name);
  assert.deepEqual(names, ['过劳惩罚', '名气分段流动', '高压计数', '长期高压警报', '幸运日']);

  let n = 0;
  const makeId = () => `t${++n}`;

  const overwork = materializeRulePreset(GAME_RULE_PRESETS.find((p) => p.name === '过劳惩罚'), makeId);
  assert.equal(overwork.rule.name, '过劳惩罚');
  assert.equal(overwork.rule.when, 'day');
  assert.equal(overwork.rule.role, 'event');
  assert.equal(overwork.events.length, 1);
  assert.equal(overwork.events[0].name, '过劳惩罚');
  assert.equal(overwork.rule.branches[0].eventId, overwork.events[0].id);
  assert.deepEqual(linkedLibraryEventNames(overwork.rule, overwork.events), ['过劳惩罚']);
  // 效果在事件上，不在规则分支里摊开成「每天结束」
  assert.equal(overwork.events[0].effects[0].key, 'stress');
  assert.notEqual(overwork.rule.name, '每天结束');

  const lucky = materializeRulePreset(GAME_RULE_PRESETS.find((p) => p.name === '幸运日'), makeId);
  assert.equal(lucky.rule.name, '幸运日');
  assert.equal(lucky.events[0].name, '幸运日');
  assert.equal(lucky.rule.chance, 10);
  assert.equal(lucky.rule.branches[0].eventId, lucky.events[0].id);

  const fame = materializeRulePreset(GAME_RULE_PRESETS.find((p) => p.name === '名气分段流动'), makeId);
  assert.equal(fame.rule.name, '名气分段流动');
  assert.equal(fame.rule.when, 'week');
  assert.equal(fame.events.length, 3);
  assert.ok(fame.events.every((e) => e.name.startsWith('名气分段流动')));
  assert.equal(fame.rule.branches.length, 3);
  assert.ok(fame.rule.branches.every((b) => b.eventId));

  const flag = materializeRulePreset(GAME_RULE_PRESETS.find((p) => p.name === '高压计数'), makeId);
  assert.equal(flag.rule.name, '高压计数');
  assert.equal(flag.rule.role, 'flag');
  assert.equal(flag.events.length, 0);
  assert.equal(flag.rule.branches[0].effects[0].kind, 'flag');
  assert.deepEqual(linkedLibraryEventNames(flag.rule, []), []);
});

test('resolveRuleBranchEffects_合并事件库效果与规则变量', async () => {
  const { resolveRuleBranchEffects } = await import(pathToFileURL(join(romance, 'lib/gameRulePresets.ts')).href);
  const lib = [{ id: 'ev_lucky', prompt: '捡到彩票', effects: [{ kind: 'metric', key: 'money', delta: 200 }] }];
  const hit = resolveRuleBranchEffects({ effects: [], eventId: 'ev_lucky' }, lib);
  assert.deepEqual(hit.effects, [{ kind: 'metric', key: 'money', delta: 200 }]);
  assert.equal(hit.notice, '捡到彩票');
  const withFlag = resolveRuleBranchEffects(
    { effects: [{ kind: 'flag', key: '高压天数', delta: 0, set: true }], eventId: 'ev_alert', notice: '警报' },
    [{ id: 'ev_alert', prompt: '忽略', effects: [{ kind: 'metric', key: 'reputation', delta: -3 }] }],
  );
  assert.equal(withFlag.effects.length, 2);
  assert.equal(withFlag.effects[0].key, 'reputation');
  assert.equal(withFlag.effects[1].key, '高压天数');
  assert.equal(withFlag.notice, '警报');
  assert.deepEqual(resolveRuleBranchEffects({ effects: [{ kind: 'flag', key: 'a', delta: 1 }] }, []).effects[0].key, 'a');
  const fixed = readFileSync(join(romance, 'game/fixedEvents.ts'), 'utf8');
  assert.match(fixed, /resolveRuleBranchEffects/);
  assert.match(fixed, /getWorldEvents/);
});

test('GameRulesEditor_默认单行展开且预设挂钩事件库', () => {
  const editor = readFileSync(join(romance, 'components/GameRulesEditor.tsx'), 'utf8');
  assert.match(editor, /materializeRulePreset/);
  assert.match(editor, /libraryEvents/);
  assert.match(editor, /aria-expanded/);
  assert.match(editor, /规则变量/);
  assert.match(editor, /调用事件库/);
  assert.match(editor, /data-rule-role/);
  // 禁止默认把概率/冷却/否则整卡摊在外面（展开块须包在 open &&）
  assert.match(editor, /\{open && \(/);
  assert.doesNotMatch(editor, /TEMPLATES\.map/);
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /libraryEvents=\{c\.events\}/);
  assert.match(panel, /判定时机 · 条件 · 调用事件库 · 规则变量/);
});
