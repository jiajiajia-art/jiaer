/**
 * 扣费依据 / 固定账单：创作者自勾选自填；禁止写死娱乐圈违约金等；未启用项不进入说明。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('enabledChargeItems_只保留勾选且有名称的项', async () => {
  const { enabledChargeItems } = await import(pathToFileURL(join(romance, 'game/chargeBasis.ts')).href);
  assert.deepEqual(enabledChargeItems(undefined), []);
  assert.deepEqual(
    enabledChargeItems([
      { id: 'a', label: '房租', mode: 'passive' },
      { id: 'b', label: '违约金', mode: 'passive', on: false },
      { id: 'c', label: '  ', mode: 'active' },
      { id: 'd', label: '路费', mode: 'active', on: true },
    ]).map((x) => x.id),
    ['a', 'd'],
  );
});

test('ModEconomyRulesPanel_已删扣费依据UI_无写死娱乐圈清单', () => {
  const eco = read('components/ModEconomyRulesPanel.tsx');
  assert.doesNotMatch(eco, /课程学费、周末社交/);
  assert.doesNotMatch(eco, /出行路费、场景购物/);
  assert.doesNotMatch(eco, /购车、婚礼/);
  assert.doesNotMatch(eco, /违约金和事件后果/);
  // 功能注释：扣费依据 UI 整块删除，面板不再读 chargeBasis / 不再有主动·被动扣费分栏
  assert.doesNotMatch(eco, /还没有扣费依据/);
  assert.doesNotMatch(eco, /扣费依据/);
  assert.doesNotMatch(eco, /添加扣费项/);
  assert.doesNotMatch(eco, /from ["']\.\.\/game\/chargeBasis["']/);
  assert.doesNotMatch(eco, /mode === "active"/);
  assert.doesNotMatch(eco, /mode === "passive"/);
  assert.doesNotMatch(eco, /enabledChargeItems/);
  // 功能注释：保存时顺手清掉旧稿遗留的 chargeItems
  assert.match(eco, /delete next\.chargeItems/);
  const plot = read('components/PlotLinesTabs.tsx');
  assert.doesNotMatch(plot, /扣费依据/);
});

test('周结算_不使用chargeItems扣费名单_无账单无生活开销不收官不加压', () => {
  const logic = read('game/logic.ts');
  const data = read('game/data.ts');
  // 功能注释：周结算只吃账单 + 伙食，不读扣费依据名单
  assert.doesNotMatch(logic, /chargeItems/);
  assert.doesNotMatch(logic, /enabledChargeItems/);
  assert.doesNotMatch(data, /export const enabledChargeItems/);
  // 功能注释：无账单且无伙食（生活开销）→ 不因钱为负收官、不加透支压力
  assert.match(logic, /const hasEcoCosts = \(bills\.weekly\?\.length \?\? 0\) \+ \(bills\.monthly\?\.length \?\? 0\) > 0 \|\| !!meal/);
  assert.match(logic, /if \(hasEcoCosts && eco\.bankrupt === true && wallet\.balance\(n\) < bankruptLine\)/);
  assert.match(logic, /if \(hasEcoCosts && wallet\.balance\(n\) < 0 && typeof eco\.overdraftStress === "number"/);
  // 功能注释：破产结束默认关（不再 !== false）；提示不得再叫玩家打工接活
  assert.doesNotMatch(logic, /eco\.bankrupt !== false/);
  assert.doesNotMatch(logic, /多安排打工\/接活回血/);
});

test('ModRulesEditor_账单从空白添加_不灌入RAW_BILLS', () => {
  const rules = read('components/ModRulesEditor.tsx');
  assert.doesNotMatch(rules, /RAW_BILLS/);
  assert.doesNotMatch(rules, /以默认账单为起点/);
  assert.doesNotMatch(rules, /恢复默认账单/);
  assert.match(rules, /添加固定账单/);
  assert.match(rules, /清空账单/);
  assert.match(rules, /weekly: \[\{ label: "", amount: 0 \}\]/);
});
