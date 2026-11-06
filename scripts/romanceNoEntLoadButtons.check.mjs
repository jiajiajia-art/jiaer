/**
 * 编辑器禁止「载入娱乐圈」一键预填；引擎规则 / 经济收官不再套用娱乐圈对比与假收支。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('编辑器无载入娱乐圈按钮', () => {
  const files = [
    'components/DataForm.tsx',
    'components/ModPackEditors.tsx',
    'components/ModPathsEditor.tsx',
    'components/ModCreationFieldsEditor.tsx',
    'components/ModEditorPanel.tsx',
    'components/ModTuningEditor.tsx',
    'components/ModPoolsEditor.tsx',
  ];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /载入娱乐圈/, `${f} 仍含「载入娱乐圈」`);
    assert.doesNotMatch(src, /恢复娱乐圈默认/, `${f} 仍含「恢复娱乐圈默认」`);
  }
});

test('引擎规则编辑器未写则空_不回填RAW崩溃与对接', () => {
  const src = read('components/ModTuningEditor.tsx');
  assert.doesNotMatch(src, /RAW_CRASH_MODS/);
  assert.doesNotMatch(src, /RAW_GIG_REPAIRS/);
  assert.doesNotMatch(src, /RAW_GIG_MANAGERS/);
  assert.doesNotMatch(src, /RAW_FAIL_FX/);
  assert.doesNotMatch(src, /RAW_LESSON_GRADES/);
  assert.match(src, /还没写，开局不会生效/);
  // 按模块勾选；未勾不展示工作/违约/课程等块
  assert.match(src, /TUNING_MODULE_META/);
  assert.match(src, /on\("work"\)/);
  assert.match(src, /on\("breach"\)/);
  assert.match(src, /工作结算规则/);
  assert.match(src, /课程倍率与等级/);
});

test('hasAuthoredGigRules契约_空对象不算已写', () => {
  const src = read('game/data.ts');
  assert.match(src, /export const hasAuthoredGigRules[\s\S]*Object\.keys\(gr\)\.length > 0/);
  // 与 data.ts 同语义：仅非空 gigRules 视为旧作已配置
  const hasAuthoredGigRules = (gr) => !!(gr && Object.keys(gr).length > 0);
  assert.equal(hasAuthoredGigRules(undefined), false);
  assert.equal(hasAuthoredGigRules(null), false);
  assert.equal(hasAuthoredGigRules({}), false);
  assert.equal(hasAuthoredGigRules({ crashOn: true }), true);
  assert.equal(hasAuthoredGigRules({ breachBase: 8 }), true);
});

test('世界生成sanitize剥掉tuning.gigRules', async () => {
  const { pathToFileURL } = await import('node:url');
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const out = gen.sanitizeWorldGenAiPatch('tuning', {
    tuning: { restStress: 5, gigRules: { crashOn: true, breachBase: 8, managers: [{ types: '广告', name: '孟晚乔', loc: '璀璨广告中心' }] } },
  });
  assert.deepEqual(out.tuning, { restStress: 5 });
  assert.equal('gigRules' in (out.tuning ?? {}), false);
  const onlyGig = gen.sanitizeWorldGenAiPatch('tuning', { tuning: { gigRules: { crashOn: true } } });
  assert.equal(onlyGig.tuning, undefined);
});

test('经济收官与balance库不套用娱乐圈对比', () => {
  const editor = read('components/ModEditorPanel.tsx');
  const balLib = read('mods/balance.ts');
  const ecoUi = read('components/ModEconomyRulesPanel.tsx');
  assert.doesNotMatch(editor, /和娱乐圈原版比/);
  assert.doesNotMatch(balLib, /原版最大约/);
  assert.doesNotMatch(balLib, /原版约/);
  assert.doesNotMatch(balLib, /是原版的/);
  // 功能注释：扣费与破产都在结局经济面板；不得套娱乐圈对比文案
  assert.match(ecoUi, /扣费依据/);
  assert.doesNotMatch(ecoUi, /还没有收支/);
  assert.doesNotMatch(ecoUi, /GENERIC_BILLS/);
  assert.doesNotMatch(ecoUi, /RAW_SIDE_JOBS/);
  assert.doesNotMatch(ecoUi, /billsSlot\(\)/);
  assert.doesNotMatch(ecoUi, /startMoney\(\)/);
  assert.match(ecoUi, /经济规则/);
  assert.match(ecoUi, /① 基础 → 建角/);
  assert.doesNotMatch(ecoUi, /和娱乐圈原版比/);
});

test('局内非娱乐圈不回落苏晴崩溃与娱乐圈对接表', () => {
  const src = read('game/logic.ts');
  assert.match(src, /getWorldId\(\) === "ent"/);
  assert.match(src, /gr\.crashMods \?\? \(ent \? RAW_CRASH_MODS : \[\]\)/);
  assert.match(src, /gr\.failFx \?\? \(ent \? RAW_FAIL_FX : \[\]\)/);
  assert.match(src, /gr\.repairs \?\? \(ent \? RAW_GIG_REPAIRS : \[\]\)/);
  // 非娱乐圈未写违约/休息不套用娱乐圈 8/14 与减压 8
  assert.match(src, /entBreach/);
  assert.match(src, /br\.breachBase \?\? 0/);
  assert.match(src, /引擎规则未写减压，无效果/);
  assert.match(src, /gr\.failPayMax \?\? \(ent \? 30 : 0\)/);
});
