/**
 * 建角字段 AI 生成：正好 3 条有名称属性 + 属性说明；开局资金货币名可补全。
 * 禁止留下「未命名」或空壳字段。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('normalizeWorldGenCustomAttrs_丢掉未命名并最多保留3条且补属性说明', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenCreationAttrs.ts')).href);
  assert.equal(mod.WORLD_GEN_CUSTOM_ATTRS_COUNT, 3);
  const cleaned = mod.normalizeWorldGenCustomAttrs([
    { id: 'a', label: '洞察', init: 3, min: 1, max: 10, desc: '对气氛的觉察。' },
    { id: 'b', label: '未命名', init: 1, min: 0, max: 10 },
    { id: 'c', label: '', init: 1 },
    { id: 'd', label: '魅力', init: 5, min: 0, max: 100 },
    { id: 'e', label: '体力', init: 8, min: 0, max: 20 },
    { id: 'f', label: '多余', init: 1, min: 0, max: 5 },
  ]);
  assert.equal(cleaned.length, 3);
  assert.deepEqual(cleaned.map((a) => a.label), ['洞察', '魅力', '体力']);
  assert.equal(cleaned[0].desc, '对气氛的觉察。');
  assert.match(cleaned[1].desc, /魅力/);
  assert.match(cleaned[2].desc, /体力/);
  assert.equal(mod.normalizeWorldGenCustomAttrs([{ label: '未命名' }, { label: '' }]).length, 0);
  assert.equal(mod.normalizeWorldGenCustomAttrs(null).length, 0);
});

test('ensureWorldGenStartMoney_补货币名与非负金额', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenCreationAttrs.ts')).href);
  assert.equal(mod.inferWorldGenMoneyLabel({ setting: '修真宗门争夺灵石。' }), '灵石');
  assert.equal(mod.inferWorldGenMoneyLabel({ setting: '当代都市恋爱。' }), '元');
  const patched = mod.ensureWorldGenStartMoney(
    { startMoney: -3 },
    { setting: '仙侠门派。' },
  );
  assert.equal(patched.startMoney, 0);
  assert.equal(patched.moneyLabel, '灵石');
  assert.equal(
    mod.ensureWorldGenStartMoney({ startMoney: 500, moneyLabel: '两' }).moneyLabel,
    '两',
  );
});

test('sanitizeWorldGenBatchPatch_清洗customAttrs与moneyLabel', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const out = gen.sanitizeWorldGenBatchPatch(['creation', 'startResources'], {
    customAttrs: [
      { id: 'x', label: '未命名', init: 1, min: 0, max: 10 },
      { id: 'y', label: '口才', init: 4, min: 1, max: 10 },
      { id: 'z', label: '运气', init: 2, min: 0, max: 10 },
      { id: 'w', label: '耐力', init: 3, min: 0, max: 10 },
    ],
    startMoney: 100,
    moneyLabel: '  灵石  ',
  });
  assert.equal(out.customAttrs.length, 3);
  assert.ok(out.customAttrs.every((a) => a.label && a.label !== '未命名'));
  assert.ok(out.customAttrs.every((a) => typeof a.desc === 'string' && a.desc.length > 0));
  assert.equal(out.moneyLabel, '灵石');
});

test('世界生成提示与向导_要求3条有名属性且货币名', () => {
  const gen = read('lib/worldGenGenerate.ts');
  const lean = read('lib/worldGenProgressDetail.ts');
  const attrsEd = read('components/ModAttrsEditor.tsx');
  const editor = read('components/ModCreationFieldsEditor.tsx');
  assert.match(gen, /WORLD_GEN_CUSTOM_ATTRS_COUNT/);
  assert.match(gen, /normalizeWorldGenCustomAttrs/);
  assert.match(gen, /ensureWorldGenStartMoney/);
  assert.match(gen, /必须正好 \$\{WORLD_GEN_CUSTOM_ATTRS_COUNT\} 条/);
  assert.match(gen, /moneyLabel/);
  assert.match(lean, /customAttrs 正好 3 条/);
  assert.match(attrsEd, /属性说明/);
  assert.doesNotMatch(attrsEd, />投骰子</);
  assert.match(attrsEd, /type="checkbox"/);
  assert.match(attrsEd, /固定数值/);
  assert.match(editor, /Badge tone="gold">必填/);
  assert.match(editor, /货币名称/);
  assert.doesNotMatch(editor, /Badge tone="jade">货币/);
});
