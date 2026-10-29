/**
 * 自定义属性开局：同一属性二选一（固定数值 / 投骰子）。
 * 骰子只在开局由代码掷，夹到最小最大；编辑器当场校验面数。
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

test('AttrDef_同一属性带initMode与dice_不是两种属性类型', () => {
  assert.match(types, /initMode\?: "fixed" \| "dice"/);
  assert.match(types, /dice\?: number/);
  assert.match(editor, /开局取值/);
  assert.match(editor, /固定数值/);
  assert.match(editor, /投骰子/);
  assert.doesNotMatch(editor, /固定数值属性|骰子属性/);
  assert.match(editor, /attrDiceProblem/);
});

test('attrDiceProblem_面数缺省或非正整数当场提示', () => {
  assert.equal(lib.attrDiceProblem({ initMode: 'fixed' }), null);
  assert.equal(lib.attrDiceProblem({}), null);
  assert.equal(lib.attrDiceProblem({ initMode: 'dice' }), '请填写骰子面数');
  assert.equal(lib.attrDiceProblem({ initMode: 'dice', dice: undefined }), '请填写骰子面数');
  assert.equal(lib.attrDiceProblem({ initMode: 'dice', dice: 0 }), '骰子面数须为正整数');
  assert.equal(lib.attrDiceProblem({ initMode: 'dice', dice: -3 }), '骰子面数须为正整数');
  assert.equal(lib.attrDiceProblem({ initMode: 'dice', dice: 1.5 }), '骰子面数须为正整数');
  assert.equal(lib.attrDiceProblem({ initMode: 'dice', dice: 20 }), null);
});

test('attrStartValue_固定用init_骰子由代码掷并夹到范围', () => {
  assert.equal(lib.attrStartValue({ init: 12, min: 0, max: 100 }), 12);
  assert.equal(lib.attrStartValue({ init: 999, min: 0, max: 50 }), 50);
  assert.equal(lib.attrStartValue({ init: -5, min: 0, max: 50 }), 0);
  // rand=0 → 掷出 1；rand 接近 1 → 掷出面数
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'dice', dice: 6, min: 0, max: 100 }, () => 0), 1);
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'dice', dice: 6, min: 0, max: 100 }, () => 0.999), 6);
  // 面数大于上限：夹到 max
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'dice', dice: 100, min: 1, max: 10 }, () => 0.99), 10);
  // 掷点小于下限：夹到 min
  assert.equal(lib.attrStartValue({ init: 0, initMode: 'dice', dice: 6, min: 10, max: 20 }, () => 0), 10);
  // 面数非法时退回固定 init（开局兜底，编辑器应已提示）
  assert.equal(lib.attrStartValue({ init: 7, initMode: 'dice', dice: 0, min: 0, max: 100 }, () => 0.5), 7);
});

test('开局写入走playerAttrsFromCreatorDefs_不把掷点交给AI', () => {
  assert.match(ctx, /playerAttrsFromCreatorDefs\(defs\)/);
  assert.match(ctx, /只掷一次，不交给 AI/);
  assert.doesNotMatch(ctx, /Math\.min\(attrCap\(d\.max\), d\.init\)/);
  assert.match(editor, /不交给生成文本的模型/);
});
