/**
 * 自定义属性开局：勾选「固定数值」用 init；不勾则在最小～最大随机。
 * 旧 initMode=dice 按范围随机；编辑器不再提供「投骰子」切换。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const lib = await import(pathToFileURL(join(romance, 'lib/attrInit.ts')).href);
const editor = readFileSync(join(romance, 'components/ModAttrsEditor.tsx'), 'utf8');
const ctx = readFileSync(join(romance, 'store/GameContext.tsx'), 'utf8');
const types = readFileSync(join(romance, 'lib/types.ts'), 'utf8');

test('AttrDef_开局取值含fixed与random_编辑器只用固定数值勾选', () => {
  assert.match(types, /initMode\?: "fixed" \| "random" \| "dice"/);
  assert.match(editor, /开局取值/);
  assert.match(editor, /固定数值/);
  assert.doesNotMatch(editor, />投骰子</);
  assert.match(editor, /type="checkbox"/);
  assert.match(editor, /attrUsesRandomStart/);
  assert.match(editor, /属性说明/);
  assert.doesNotMatch(editor, /固定数值属性|骰子属性/);
});

test('attrUsesRandomStart与attrDiceProblem_范围随机须有最大', () => {
  assert.equal(lib.attrUsesRandomStart({}), false);
  assert.equal(lib.attrUsesRandomStart({ initMode: 'fixed' }), false);
  assert.equal(lib.attrUsesRandomStart({ initMode: 'random' }), true);
  assert.equal(lib.attrUsesRandomStart({ initMode: 'dice' }), true);
  assert.equal(lib.attrDiceProblem({ initMode: 'fixed' }), null);
  assert.equal(lib.attrDiceProblem({}), null);
  assert.equal(lib.attrDiceProblem({ initMode: 'random', min: 1 }), '随机开局须填写不小于最小值的最大');
  assert.equal(lib.attrDiceProblem({ initMode: 'random', min: 1, max: 10 }), null);
  assert.equal(lib.attrDiceProblem({ initMode: 'dice', min: 0, max: 20 }), null);
});

test('attrStartValue_固定用init_随机在最小最大之间', () => {
  assert.equal(lib.attrStartValue({ init: 12, min: 0, max: 100 }), 12);
  assert.equal(lib.attrStartValue({ init: 999, min: 0, max: 50 }), 50);
  assert.equal(lib.attrStartValue({ init: -5, min: 0, max: 50 }), 0);
  // rand=0 → 下限；rand 接近 1 → 上限
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'random', min: 1, max: 6 }, () => 0), 1);
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'random', min: 1, max: 6 }, () => 0.999), 6);
  // 旧 dice 同样按范围随机
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'dice', dice: 100, min: 2, max: 5 }, () => 0), 2);
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'dice', dice: 100, min: 2, max: 5 }, () => 0.999), 5);
  // 无有效上限时退回固定 init
  assert.equal(lib.attrStartValue({ init: 7, initMode: 'random', min: 0 }, () => 0.5), 7);
});

test('开局写入走playerAttrsFromCreatorDefs_不把随机交给AI', () => {
  assert.match(ctx, /playerAttrsFromCreatorDefs\(defs\)/);
  assert.match(ctx, /只掷一次，不交给 AI/);
  assert.doesNotMatch(ctx, /Math\.min\(attrCap\(d\.max\), d\.init\)/);
  assert.match(editor, /不交给生成文本的模型/);
});

test('开局取值四种模式_随机锁定选择自定义', async () => {
  const mod = await import(join(root, 'Romance/src/lib/attrInit.ts'));
  assert.equal(mod.attrStartMode({}), 'locked');
  assert.equal(mod.attrStartMode({ initMode: 'fixed' }), 'locked');
  assert.equal(mod.attrStartMode({ initMode: 'dice' }), 'random');
  assert.equal(mod.attrStartMode({ initMode: 'custom' }), 'custom');
  assert.equal(mod.attrStartMode({ initMode: 'choice', options: [] }), 'locked');
  const choice = { init: 1, min: 0, max: 10, initMode: 'choice', options: [{ label: '书香门第', value: 7 }, { label: '', value: 3 }] };
  assert.equal(mod.attrStartMode(choice), 'choice');
  assert.equal(mod.attrChoiceOptions(choice).length, 1);
  assert.equal(mod.attrStartValue(choice), 7);
  assert.equal(mod.attrStartValue({ init: 4, min: 0, max: 10, initMode: 'custom' }), 4);
  const cc = readFileSync(join(root, 'Romance/src/components/CharacterCreate.tsx'), 'utf8');
  assert.match(cc, /data-attr-mode=\{mode\}/);
  assert.match(cc, /rerollOne\(a\)/);
  assert.match(cc, /attrStartMode\(a\) === "random"/);
});
