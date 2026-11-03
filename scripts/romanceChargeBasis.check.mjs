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

test('ModBalancePanel_无写死娱乐圈扣费清单', () => {
  const bal = read('components/ModBalancePanel.tsx');
  // 功能注释：只查 JSX/字面量清单，注释里可提及「不预置」而不点名旧剧本项
  assert.doesNotMatch(bal, /课程学费、周末社交/);
  assert.doesNotMatch(bal, /出行路费、场景购物/);
  assert.doesNotMatch(bal, /购车、婚礼/);
  assert.doesNotMatch(bal, /违约金和事件后果/);
  assert.match(bal, /还没有扣费依据/);
  assert.match(bal, /from ["']\.\.\/game\/chargeBasis["']/);
  assert.match(bal, /mode === "active"/);
  assert.match(bal, /mode === "passive"/);
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
