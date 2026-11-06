/**
 * 经济配置：养成页不再出现扣费/收官；扣费依据 + 破产规则挂在④剧情 → 结局。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const wizard = readFileSync(join(romance, 'lib/worldGenWizard.ts'), 'utf8');
const eco = readFileSync(join(romance, 'components/ModEconomyRulesPanel.tsx'), 'utf8');
const tuning = readFileSync(join(romance, 'components/ModTuningEditor.tsx'), 'utf8');
const plot = readFileSync(join(romance, 'components/PlotLinesTabs.tsx'), 'utf8');

test('ModEditorPanel_无数值体检无养成数值平衡', () => {
  assert.doesNotMatch(panel, /title="数值体检"/);
  assert.doesNotMatch(panel, /ModHealthPanel/);
  assert.doesNotMatch(panel, /没发现明显失衡/);
  assert.doesNotMatch(panel, /title="数值平衡"/);
  assert.doesNotMatch(panel, /数值体检有提醒/);
});

test('ModEditorPanel_养成无经济_结局挂扣费与经济规则', () => {
  assert.doesNotMatch(panel, /title="经济与收官"/);
  assert.doesNotMatch(panel, /g="grow"[\s\S]*?ModBalancePanel/);
  assert.doesNotMatch(panel, /g="grow"[\s\S]*?title="引擎规则"/);
  assert.match(panel, /import ModEconomyRulesPanel/);
  assert.match(panel, /title="总养成开关"/);
  // 功能注释：结局小节须挂经济规则面板（含扣费）；养成区不得再堆破产/扣费
  assert.match(panel, /end=\{[\s\S]*?ModEconomyRulesPanel/);
  assert.match(panel, /showBills=\{isGrowModuleOn/);
  assert.match(plot, /扣费依据/);
  assert.match(plot, /破产线/);
});

test('worldGenWizard_经济旧步骤并入养成tuning', async () => {
  assert.doesNotMatch(wizard, /name: "数值平衡"/);
  assert.doesNotMatch(wizard, /id: "economy"/);
  assert.match(wizard, /economy: \["tuning"\]/);
  assert.match(wizard, /endings: \["storylines"\]/);
  assert.match(wizard, /name: "剧情线"/);
  assert.match(wizard, /引擎规则与经济/);
  assert.match(wizard, /破产规则在结局配置/);
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const n = mod.normalizeWorldGenStep1({
    ...mod.defaultWorldGenStep1(),
    editorStepIds: ['economy', 'prompt'],
  });
  // 功能注释：economy→tuning 映射仍在；tuning 非基础世界，生成勾选会剥掉，只留 prompt
  assert.ok(!n.editorStepIds.includes('economy'));
  assert.ok(!n.editorStepIds.includes('tuning'));
  assert.deepEqual(n.editorStepIds, ['prompt']);
});

test('ModEconomyRulesPanel_含扣费依据与全部经济规则字段', () => {
  assert.match(eco, /扣费依据/);
  assert.match(eco, /添加扣费项/);
  assert.match(eco, /chargeItems/);
  assert.match(eco, /enabledChargeItems/);
  assert.match(eco, /经济规则/);
  assert.match(eco, /透支超过破产线时结束游戏/);
  assert.match(eco, /破产线（透支金额）/);
  assert.match(eco, /透支每周压力/);
  assert.match(eco, /新手缓冲（前 N 周）/);
  assert.match(eco, /缓冲期账单倍率/);
  assert.match(eco, /bankruptLine/);
  assert.match(eco, /overdraftStress/);
  assert.match(eco, /graceWeeks/);
  assert.match(eco, /graceBillMul/);
  assert.match(eco, /data-author-section="economy-rules"/);
  assert.doesNotMatch(eco, /每 4 周现金流/);
  assert.doesNotMatch(eco, /③ 养成 → 经济与收官/);
});

test('ModTuningEditor_可隐藏模块勾选清单_课程通告违约按玩法门控', () => {
  assert.match(tuning, /showCourses/);
  assert.match(tuning, /showJobs/);
  assert.match(tuning, /showCareer/);
  assert.match(tuning, /showModulePicker/);
  assert.match(tuning, /visibleModules/);
  assert.match(tuning, /m\.id === "course"/);
  assert.match(tuning, /m\.id === "work" \|\| m\.id === "breach"/);
  assert.match(tuning, /未添加通告/);
});
