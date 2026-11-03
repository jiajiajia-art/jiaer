/**
 * 经济与收官：养成只留扣费依据；删掉「每4周现金流估算」；
 * 经济规则（破产线 / 透支压力 / 新手缓冲等）挂在④剧情 → 结局。
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
const bal = readFileSync(join(romance, 'components/ModBalancePanel.tsx'), 'utf8');
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

test('ModEditorPanel_扣费在养成_经济规则在结局', () => {
  assert.match(panel, /title="经济与收官"/);
  assert.match(panel, /g="grow"[\s\S]*?title="经济与收官"[\s\S]*?ModBalancePanel/);
  assert.match(panel, /import ModEconomyRulesPanel/);
  // 功能注释：结局小节须挂经济规则面板；养成区不得再堆破产字段
  assert.match(panel, /end=\{[\s\S]*?ModEconomyRulesPanel/);
  assert.match(panel, /g="grow"[\s\S]*?title="引擎规则"/);
  assert.match(panel, /showCourses=\{isGrowModuleOn/);
  assert.match(panel, /showCareer=\{showCareerNpcFields\}/);
  assert.match(plot, /经济规则/);
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

test('ModBalancePanel_只留扣费依据_禁止现金流与经济规则', () => {
  assert.match(bal, /扣费依据/);
  assert.match(bal, /添加扣费项/);
  assert.match(bal, /chargeItems/);
  assert.match(bal, /enabledChargeItems/);
  // 功能注释：禁止 UI 文案再出现现金流估算块或破产规则表单
  assert.doesNotMatch(bal, /每 4 周现金流估算/);
  assert.doesNotMatch(bal, />还没有收支</);
  assert.doesNotMatch(bal, /透支超过破产线时结束游戏/);
  assert.doesNotMatch(bal, /破产线（透支金额）/);
  assert.doesNotMatch(bal, /透支每周压力/);
  assert.doesNotMatch(bal, /新手缓冲（前 N 周）/);
  assert.doesNotMatch(bal, /缓冲期账单倍率/);
  assert.doesNotMatch(bal, /课程学费、周末社交/);
  assert.doesNotMatch(bal, /购车、婚礼/);
  assert.match(bal, /④ 剧情 → 结局/);
});

test('ModEconomyRulesPanel_挂结局且含全部经济规则字段', () => {
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
  assert.doesNotMatch(eco, /添加扣费项/);
  assert.doesNotMatch(eco, /chargeItems/);
});

test('ModTuningEditor_课程通告违约按玩法门控', () => {
  assert.match(tuning, /showCourses/);
  assert.match(tuning, /showJobs/);
  assert.match(tuning, /showCareer/);
  assert.match(tuning, /visibleModules/);
  assert.match(tuning, /m\.id === "course"/);
  assert.match(tuning, /m\.id === "work" \|\| m\.id === "breach"/);
  assert.match(tuning, /未添加通告/);
});
