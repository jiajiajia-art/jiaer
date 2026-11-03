/**
 * 图1/图2：开局资金——货币名可改、默认 0、必填；预览弹窗定位到建角行并高亮。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');
const { assessAuthorRequiredFields } = await import(join(romance, 'lib/authorPreview.ts'));

const completeMod = (patch = {}) => {
  const { content, ...manifest } = patch;
  return {
    id: 'required-world',
    name: '雾色旅馆',
    version: '1.0.0',
    kind: 'world',
    ...manifest,
    content: {
      prompt: { scriptTone: '雨夜旅馆。' },
      startDate: '2026.10.30',
      startMoney: 0,
      moneyLabel: '元',
      rooms: { lobby: { name: '大厅', desc: '雨', exits: {} } },
      startRoom: 'lobby',
      cover: { image: 'data:image/png;base64,cover' },
      opening: { paragraphs: ['门铃响了。'] },
      ...(content ?? {}),
    },
  };
};

test('blankMod_新建世界默认开局资金0且货币名元', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /startMoney: 0, moneyLabel: "元"/);
  assert.deepEqual(assessAuthorRequiredFields(completeMod({
    content: { startMoney: 0, moneyLabel: '元' },
  })).map((i) => i.field), []);
});

test('authorRequired_资金为0且有货币名_不拦截_仅缺开场时无资金项', () => {
  assert.deepEqual(assessAuthorRequiredFields(completeMod()), []);
  const onlyOpening = assessAuthorRequiredFields(completeMod({ content: { opening: {} } }));
  assert.deepEqual(onlyOpening.map((i) => i.field), ['opening']);
  assert.ok(!onlyOpening.some((i) => i.field === 'startMoney'));
});

test('authorRequired_缺货币名或金额为空_拦截且定位基础建角', () => {
  const noName = assessAuthorRequiredFields(completeMod({ content: { moneyLabel: '' } }));
  const money = noName.find((i) => i.field === 'startMoney');
  assert.ok(money);
  assert.equal(money.group, 'base');
  assert.equal(money.target, 'author-field-start-money');
  const noAmt = assessAuthorRequiredFields(completeMod({ content: { startMoney: undefined } }));
  assert.ok(noAmt.some((i) => i.field === 'startMoney'));
  const neg = assessAuthorRequiredFields(completeMod({ content: { startMoney: -1 } }));
  assert.ok(neg.some((i) => i.field === 'startMoney'));
});

test('ModCreationFieldsEditor_货币名可改_必填徽标_锚点在行上', () => {
  const editor = read('components/ModCreationFieldsEditor.tsx');
  assert.match(editor, /货币名称 \*/);
  assert.match(editor, /开局金额 \*/);
  assert.match(editor, /Badge tone="gold">必填/);
  // 功能注释：行上类型位展示货币名称，不再叠一枚「货币」徽标
  assert.doesNotMatch(editor, /Badge tone="jade">货币/);
  assert.match(editor, /moneyLabel\?\.trim\(\) \|\| "货币名称"/);
  assert.match(editor, /authorField: "author-field-start-money"/);
  assert.match(editor, /focusAuthorField/);
  assert.match(editor, /setFlashMoney\(true\)/);
  assert.match(editor, /onMoneyLabel/);
  assert.match(editor, /placeholder="如：元 \/ 灵石 \/ 星币"/);
});

test('ModEditorPanel_补全跳转开局资金切基础并focusAuthorField', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /setFocusAuthorField\(issue\.target\)/);
  assert.match(panel, /focusAuthorField=\{focusAuthorField\}/);
  assert.match(panel, /moneyLabel=\{c\.moneyLabel\}/);
  assert.match(panel, /onMoneyLabel=\{\(v\) => setC\(\{ moneyLabel: v \}\)\}/);
  assert.match(panel, /startMoney: 0, moneyLabel: "元"/);
});

test('types与registry_moneyLabel进槽且术语优先', () => {
  const types = read('mods/types.ts');
  const reg = read('mods/registry.ts');
  assert.match(types, /moneyLabel\?: string/);
  assert.match(types, /"moneyLabel"/);
  assert.match(reg, /c\.moneyLabel/);
  assert.match(reg, /优先用建角「开局资金」货币名称/);
});
