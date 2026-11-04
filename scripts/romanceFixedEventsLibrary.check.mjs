/**
 * 新建作品固定事件：事件库从空开始，不带娱乐圈 123 条预设 / 全部导入 / 分组导入。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveModEventLibrary } from '../Romance/src/game/resolveEventLibrary.ts';
import {
  draftModFromWorldGen,
  defaultWorldGenStep1,
  normalizeWorldGenStep1,
  contentIdsFromEditorSteps,
} from '../Romance/src/lib/worldGenWizard.ts';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

const ENT_PRESET = /失约补救|署名协商|服装损坏|节目救场|排播延期|片场争执|Demo泄露|记者误引|支线与随机事件池|职业库/;

test('resolveModEventLibrary_缺省为空_不带娱乐圈预设', () => {
  const empty = resolveModEventLibrary();
  assert.deepEqual(empty.events, []);
  assert.deepEqual(empty.groups, []);
  assert.equal(resolveModEventLibrary(undefined, undefined).events.length, 0);
  assert.equal(resolveModEventLibrary([], []).events.length, 0);
});

test('resolveModEventLibrary_只用本作品事件与分组', () => {
  const withOwn = resolveModEventLibrary([{ id: 'my_ev', name: '自写', prompt: 'x', once: true }]);
  assert.equal(withOwn.events.length, 1);
  assert.equal(withOwn.events[0].id, 'my_ev');
  assert.equal(withOwn.groups[0].id, 'work_events');

  const grouped = resolveModEventLibrary(undefined, [{
    id: 'custom',
    kind: 'random',
    title: '我的分组',
    desc: '作者自建',
    events: [{ id: 'a1', name: '晨会', prompt: '开会', once: true }],
  }]);
  assert.equal(grouped.groups.length, 1);
  assert.equal(grouped.groups[0].title, '我的分组');
  assert.doesNotMatch(grouped.groups[0].title, ENT_PRESET);
});

test('向导种子_不含events与eventGroups与fixedEvents', () => {
  const s1 = normalizeWorldGenStep1({
    ...defaultWorldGenStep1(),
    title: '雾港',
    setting: '海边小镇',
  });
  const seed = draftModFromWorldGen({
    ...s1,
    editorStepIds: [...s1.editorStepIds],
    contentIds: contentIdsFromEditorSteps(s1.editorStepIds),
  });
  assert.equal(seed.content.events, undefined);
  assert.equal(seed.content.eventGroups, undefined);
  assert.equal(seed.content.fixedEvents, undefined);
});

test('blankMod与编辑器接线_新建无预设事件库', () => {
  const src = read('components/ModEditorPanel.tsx');
  // 功能注释：world 默认带开局资金 0 / 货币名；addon 仍 content:{}；二者都不得预置事件库
  assert.match(src, /export function blankMod/);
  assert.match(src, /kind === "world" \? \{ startMoney: 0, moneyLabel: "元" \} : \{\}/);
  assert.doesNotMatch(src, /blankMod[\s\S]{0,400}fixedEvents\s*:/);
  assert.doesNotMatch(src, /blankMod[\s\S]{0,400}eventGroups\s*:/);
  assert.match(src, /libraryEvents=\{c\.events\}/);
  assert.match(src, /libraryGroups=\{c\.eventGroups\}/);
  assert.match(src, /禁止回退娱乐圈/);
});

test('FixedEventsPanel_空库不渲染全部导入_模组走resolveModEventLibrary', () => {
  const src = read('components/FixedEventsPanel.tsx');
  assert.match(src, /resolveModEventLibrary/);
  assert.match(src, /emptyLib/);
  assert.match(src, /不会预置娱乐圈事件/);
  assert.match(src, /emptyLib \? \([\s\S]*EmptyState[\s\S]*\) : \([\s\S]*全部导入/);
  assert.doesNotMatch(src, ENT_PRESET);
  // 模组模式必须走本作品解析，禁止用 getWorld* 当库源
  assert.match(src, /modMode\s*\n\s*\? resolveModEventLibrary/);
});

test('FixedEventsPanel_事件编辑去掉选项与结束关键词_保留链与关键词触发', () => {
  const panel = read('components/FixedEventsPanel.tsx');
  const advanced = read('components/EventAdvanced.tsx');
  // 功能注释：编辑器不再露出「事件选项 / 结束关键词」整块；关键词触发与事件链保留
  assert.doesNotMatch(panel, /label="事件选项/);
  assert.doesNotMatch(panel, /label="结束关键词/);
  assert.doesNotMatch(panel, /＋ 添加选项/);
  assert.doesNotMatch(panel, /ChoicesEditor|ChoiceAdvanced/);
  assert.doesNotMatch(panel, /placeholder="如：婚礼落幕、宾客散尽"/);
  assert.doesNotMatch(panel, /每回合持续.*结束词/);
  assert.match(panel, /label="事件链（可不填）"/);
  assert.match(panel, /label="关键词触发（可不填）"/);
  assert.match(panel, /ChainEditor/);
  assert.doesNotMatch(advanced, /ChoiceAdvanced|隐藏分支/);
});
