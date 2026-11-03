/**
 * 养成页模块勾选：开局资金进建角；课程/打工/账单等未勾不显示、不套娱乐圈默认。
 * 名气分档已并入建角数值属性；头衔改为玩法 Mod，不再占养成「养成规则」块。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('growModules纯逻辑_勾选判定与清空_无growRules', async () => {
  const mod = await import(pathToFileURL(join(romance, 'game/growModules.ts')).href);
  assert.equal(mod.isGrowModuleOn({}, 'courses'), false);
  assert.equal(mod.isGrowModuleOn({ trainings: [{ id: 'a' }] }, 'courses'), true);
  assert.equal(mod.isGrowModuleOn({ modules: undefined, growModules: { courses: false }, trainings: [{ id: 'a' }] }, 'courses'), false);
  assert.equal(mod.isGrowModuleOn({ growModules: { courses: true } }, 'courses'), true);

  assert.equal(mod.authoredGrowModule({ bills: { weekly: [] } }, 'bills'), true);
  assert.equal(mod.authoredGrowModule({ income: [{ id: 'x' }] }, 'bills'), true);
  assert.equal(mod.authoredGrowModule({ gameRules: [{ id: 'r' }] }, 'gameRules'), true);
  assert.equal(mod.authoredGrowModule({ bills: { weekly: [] } }, 'courses'), false);

  const ids = mod.GROW_MODULE_META.map((m) => m.id);
  assert.deepEqual(ids, ['courses', 'jobs', 'bills', 'gameRules']);
  assert.ok(!ids.includes('growRules'));

  const cleared = mod.clearGrowModule(
    { growModules: { jobs: true }, sideJobs: [{ id: 'sj1' }], weekendActs: [{ id: 'w1' }], trainings: [{ id: 't1' }] },
    'jobs',
  );
  assert.equal(cleared.growModules.jobs, false);
  assert.equal(cleared.sideJobs, undefined);
  assert.equal(cleared.weekendActs, undefined);
  assert.equal(cleared.trainings.length, 1);

  const billsCleared = mod.clearGrowModule({ bills: { weekly: [{ label: '房租', amount: 1 }] }, income: [{ id: 'i' }] }, 'bills');
  assert.equal(billsCleared.bills, undefined);
  assert.equal(billsCleared.income, undefined);
});

test('编辑器_开局资金在建角且养成按勾选展示_无养成规则块', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.doesNotMatch(panel, /title="开局资源"/);
  assert.match(panel, /GROW_MODULE_META/);
  assert.match(panel, /title="养成模块"/);
  assert.match(panel, /isGrowModuleOn\(c, "courses"\)/);
  assert.match(panel, /isGrowModuleOn\(c, "jobs"\)/);
  assert.match(panel, /isGrowModuleOn\(c, "bills"\)/);
  assert.match(panel, /isGrowModuleOn\(c, "gameRules"\)/);
  assert.doesNotMatch(panel, /isGrowModuleOn\(c, "growRules"\)/);
  assert.doesNotMatch(panel, /title="养成规则"/);
  assert.doesNotMatch(panel, /名气分档 · 头衔/);
  const create = panel.slice(panel.indexOf('title="建角"'), panel.indexOf('title="地点"'));
  assert.match(create, /startMoney=\{c\.startMoney\}/);
  assert.match(create, /onStartMoney=/);
  assert.match(create, /ModCreationFieldsEditor/);
  assert.match(create, /g="base"/);
  const fieldsEd = read('components/ModCreationFieldsEditor.tsx');
  assert.match(fieldsEd, /开局资金/);
  assert.match(fieldsEd, /authorField: "author-field-start-money"/);
  assert.match(fieldsEd, /分档（多少分叫什么）/);
});

test('运行时非娱乐圈课程打工周末不回落RAW', () => {
  const data = read('game/data.ts');
  assert.match(data, /slot\("trainings", \(\) => RAW_TRAININGS, \(\) => \[\]\)/);
  assert.match(data, /slot\("sideJobs", \(\) => RAW_SIDE_JOBS, \(\) => \[\]\)/);
  assert.match(data, /slot<WeekendAct\[\]>\("weekendActs", \(\) => RAW_WEEKEND_ACTS, \(\) => \[\]\)/);
  assert.match(data, /slot\("startMoney", \(\) => 5000, \(\) => 0\)/);
});

test('打工周末与账单编辑器禁止一键灌入娱乐圈默认', () => {
  const acts = read('components/ModActsEditor.tsx');
  assert.doesNotMatch(acts, /RAW_SIDE_JOBS/);
  assert.doesNotMatch(acts, /RAW_WEEKEND_ACTS/);
  assert.doesNotMatch(acts, /以默认 4 档为起点/);
  assert.doesNotMatch(acts, /以默认活动为起点/);
  assert.match(acts, /＋ 添加打工/);
  assert.match(acts, /＋ 添加活动/);

  const rules = read('components/ModRulesEditor.tsx');
  assert.doesNotMatch(rules, /RAW_FAME_TIERS/);
  assert.doesNotMatch(rules, /RAW_TITLES/);
  assert.doesNotMatch(rules, /以默认分档为起点/);
  assert.doesNotMatch(rules, /以默认头衔为起点/);
  assert.doesNotMatch(rules, /名气分档/);
  assert.doesNotMatch(rules, /showFame/);
  assert.doesNotMatch(rules, /fameTiers/);
  assert.match(rules, /showTitles/);
  assert.match(rules, /showBills/);
});

test('建角数值属性承接分档_头衔走玩法Mod', async () => {
  const attrsEd = read('components/ModAttrsEditor.tsx');
  assert.match(attrsEd, /分档/);
  assert.match(attrsEd, /任意数值属性都能配/);
  assert.match(attrsEd, /TierRows/);
  assert.doesNotMatch(attrsEd, /名气分档/);

  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /showPlay\("titles"\)/);
  assert.match(panel, /title="头衔"/);
  assert.match(panel, /pack-titles/);

  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const titles = cat.LOCAL_PLAY_MOD_CATALOG.find((x) => x.slug === 'pack-titles');
  assert.ok(titles, '目录须有头衔包');
  assert.equal(titles.name, '头衔包');
  assert.deepEqual(titles.editorPanels, ['titles']);
  assert.ok(cat.resolveInstalledEditorPanels([{ slug: 'pack-titles', enabled: true, editorPanels: ['titles'] }]).has('titles'));
  assert.ok(!cat.resolveInstalledEditorPanels([]).has('titles'));
});
