/**
 * 引擎规则按模块勾选：未勾不展示、不预填某一打工剧本数值；空着开局不生效。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('tuningModules纯逻辑_勾选判定与清空', async () => {
  const mod = await import(pathToFileURL(join(romance, 'game/tuningModules.ts')).href);
  assert.equal(mod.isTuningModuleOn({}, 'dayGrade'), false);
  assert.equal(mod.isTuningModuleOn({ modules: { dayGrade: true } }, 'dayGrade'), true);
  assert.equal(mod.isTuningModuleOn({ gradeOdds: { success: 50 } }, 'dayGrade'), true);
  assert.equal(mod.isTuningModuleOn({ modules: { dayGrade: false }, gradeOdds: { success: 50 } }, 'dayGrade'), false);

  assert.equal(mod.authoredTuningModule({ gigRules: { crashOn: true } }, 'work'), true);
  assert.equal(mod.authoredTuningModule({ gigRules: { breachBase: 8 } }, 'work'), false);
  assert.equal(mod.authoredTuningModule({ gigRules: { breachBase: 8 } }, 'breach'), true);
  assert.equal(mod.authoredTuningModule({ gigRules: { crashOn: true } }, 'breach'), false);

  const cleared = mod.clearTuningModule(
    { modules: { work: true, breach: true }, gigRules: { crashOn: true, breachBase: 8, managers: [{ types: 'a', name: 'n', loc: 'l' }] }, restStress: 5 },
    'work',
  );
  assert.equal(cleared.modules.work, false);
  assert.deepEqual(cleared.gigRules, { breachBase: 8 });
  assert.equal(cleared.restStress, 5);

  const clearedBreach = mod.clearTuningModule(
    { gigRules: { crashOn: true, breachBase: 8, breachHi: 14, breachHiTypes: '广告' } },
    'breach',
  );
  assert.deepEqual(clearedBreach.gigRules, { crashOn: true });

  const pruned = mod.pruneTuningSlot({ modules: { dayGrade: false, rest: false } });
  assert.equal(pruned, undefined);

  const enabled = mod.enableTuningModule({}, 'course');
  assert.equal(enabled.modules.course, true);
  assert.equal(enabled.lessonGrades, undefined);
  assert.equal(enabled.trainFeeMul, undefined);
});

test('编辑器按勾选展示模块_不预填RAW与娱乐圈曲线', () => {
  const src = read('components/ModTuningEditor.tsx');
  assert.match(src, /TUNING_MODULE_META/);
  assert.match(src, /本作品要用哪些规则/);
  assert.match(src, /setModule/);
  assert.match(src, /isTuningModuleOn/);
  assert.match(src, /on\("dayGrade"\)/);
  assert.match(src, /on\("work"\)/);
  assert.match(src, /on\("breach"\)/);
  assert.match(src, /on\("course"\)/);
  assert.match(src, /on\("rest"\)/);
  assert.match(src, /on\("jobPay"\)/);
  assert.doesNotMatch(src, /legacyGig/);
  assert.doesNotMatch(src, /hasAuthoredGigRules/);
  assert.doesNotMatch(src, /RAW_LESSON_GRADES/);
  assert.doesNotMatch(src, /RAW_CRASH_MODS/);
  assert.doesNotMatch(src, /RAW_GRADE_ODDS/);
  assert.doesNotMatch(src, /costMul: \(l\?\.costMul/);
  assert.match(src, /还没写，开局不会生效/);
  assert.match(src, /添加等级/);
  // 新增等级从空白起，不沿用 ×2 / ×0.75
  assert.match(src, /costMul: 0, gainMul: 0, cap: 0, stressAdd: 0/);
});

test('运行时非娱乐圈不回落RAW课程等级与评级倍率', () => {
  const data = read('game/data.ts');
  assert.match(data, /NEUTRAL_LESSON_GRADE/);
  assert.match(data, /currentWorldId\(\) === "ent" \? RAW_LESSON_GRADES/);
  assert.match(data, /perfect: 1, great: 1, success: 1, fail: 1, bad: 1/);
  const logic = read('game/logic.ts');
  assert.match(logic, /tuningHasModule\("dayGrade"\)/);
  assert.match(logic, /tuningHasModule\("rest"\)/);
  assert.match(logic, /tuningHasModule\("breach"\)/);
  assert.match(logic, /tuningHasModule\("jobPay"\)/);
  assert.match(logic, /tuningHasModule\("course"\)/);
});

test('课程编辑器不再以通用4级为起点', () => {
  const src = read('components/ModTrainingsEditor.tsx');
  assert.doesNotMatch(src, /以通用 4 级为起点/);
  assert.doesNotMatch(src, /沿用通用 4 级/);
  assert.doesNotMatch(src, /LESSON_GRADES\.map/);
  assert.match(src, /添加自定义等级（空白）/);
});
