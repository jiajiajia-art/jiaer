/**
 * 编辑器禁止「载入娱乐圈」一键预填；引擎规则 / 数值体检 / 数值平衡不再套用娱乐圈对比与假收支。
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
});

test('数值体检去掉娱乐圈对比文案', () => {
  const health = read('components/ModHealthPanel.tsx');
  const editor = read('components/ModEditorPanel.tsx');
  const bal = read('mods/balance.ts');
  assert.doesNotMatch(health, /沿用娱乐圈的内容/);
  assert.doesNotMatch(health, /对比基准是娱乐圈原版/);
  assert.doesNotMatch(editor, /和娱乐圈原版比/);
  assert.doesNotMatch(bal, /原版最大约/);
  assert.doesNotMatch(bal, /原版约/);
  assert.doesNotMatch(bal, /是原版的/);
});

test('数值平衡未写账单打工显示还没有收支', () => {
  const src = read('components/ModBalancePanel.tsx');
  assert.match(src, /还没有收支/);
  assert.doesNotMatch(src, /GENERIC_BILLS/);
  assert.doesNotMatch(src, /RAW_SIDE_JOBS/);
  assert.doesNotMatch(src, /billsSlot\(\)/);
  assert.doesNotMatch(src, /startMoney\(\)/);
});

test('局内非娱乐圈不回落苏晴崩溃与娱乐圈对接表', () => {
  const src = read('game/logic.ts');
  assert.match(src, /getWorldId\(\) === "ent"/);
  assert.match(src, /gr\.crashMods \?\? \(ent \? RAW_CRASH_MODS : \[\]\)/);
  assert.match(src, /gr\.failFx \?\? \(ent \? RAW_FAIL_FX : \[\]\)/);
  assert.match(src, /gr\.repairs \?\? \(ent \? RAW_GIG_REPAIRS : \[\]\)/);
});
