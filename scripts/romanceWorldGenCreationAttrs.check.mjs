/**
 * 建角字段 AI 生成：建议约 2–4 条有名称属性 + 属性说明；开局资金货币名可补全。
 * 禁止留下「未命名」或空壳字段；merge 不得把旧空壳拼回。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('normalizeWorldGenCustomAttrs_丢掉未命名并丢掉未命名且补属性说明', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenCreationAttrs.ts')).href);
  assert.ok(mod.WORLD_GEN_CUSTOM_ATTRS_COUNT >= 2 && mod.WORLD_GEN_CUSTOM_ATTRS_COUNT <= 4);
  const cleaned = mod.normalizeWorldGenCustomAttrs([
    { id: 'a', label: '洞察', init: 3, min: 1, max: 10, desc: '对气氛的觉察。' },
    { id: 'b', label: '未命名', init: 1, min: 0, max: 10 },
    { id: 'c', label: '', init: 1 },
    { id: 'd', label: '魅力', init: 5, min: 0, max: 100 },
    { id: 'e', label: '体力', init: 8, min: 0, max: 20 },
    { id: 'f', label: '多余', init: 1, min: 0, max: 5 },
  ]);
  assert.ok(cleaned.length >= 3);
  assert.deepEqual(cleaned.map((a) => a.label).slice(0, 3), ['洞察', '魅力', '体力']);
  assert.equal(cleaned[0].desc, '对气氛的觉察。');
  assert.match(cleaned[1].desc, /魅力/);
  assert.match(cleaned[2].desc, /体力/);
  assert.equal(mod.normalizeWorldGenCustomAttrs([{ label: '未命名' }, { label: '' }]).length, 0);
  assert.equal(mod.normalizeWorldGenCustomAttrs(null).length, 0);
  // 功能注释：模型把名称写在 name 时也要认
  assert.equal(mod.normalizeWorldGenCustomAttrs([{ id: 'x', name: '根骨', init: 1 }])[0].label, '根骨');
});

test('ensureWorldGenCustomAttrs_全空时按题材补有名属性_不写未命名', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenCreationAttrs.ts')).href);
  const filled = mod.ensureWorldGenCustomAttrs(
    { customAttrs: [{ id: 'a', label: '未命名', init: 1 }, { id: 'b', label: '洞察', init: 3, min: 0, max: 10 }] },
    { setting: '雾港悬疑旅馆，住客情绪与线索。' },
  );
  // 功能注释：已有有效属性时不补空壳；未命名被洗掉后只剩洞察
  assert.ok(filled.customAttrs.length >= 1);
  assert.ok(filled.customAttrs.every((a) => a.label && a.label !== '未命名' && !/^未命名/.test(a.label)));
  assert.equal(filled.customAttrs[0].label, '洞察');
  assert.ok(filled.customAttrs.every((a) => typeof a.desc === 'string' && a.desc.length > 0));
  const empty = mod.ensureWorldGenCustomAttrs({ customAttrs: [] }, { setting: '修真宗门争夺灵石。' });
  assert.ok(empty.customAttrs.length >= 2);
  assert.equal(empty.customAttrs[0].label, '灵力');
});

test('healCustomAttrsUnnamed_只删空壳不自动补', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenCreationAttrs.ts')).href);
  const content = {
    customAttrs: [
      { id: 'a', label: '洞察', init: 1 },
      { id: 'b', label: '未命名', init: 0 },
      { id: 'c', label: '', init: 0 },
    ],
  };
  const notes = mod.healCustomAttrsUnnamed(content);
  assert.equal(notes.length, 1);
  assert.equal(content.customAttrs.length, 1);
  assert.equal(content.customAttrs[0].label, '洞察');
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
  assert.ok(out.customAttrs.length >= 3);
  assert.ok(out.customAttrs.every((a) => a.label && a.label !== '未命名'));
  assert.ok(out.customAttrs.every((a) => typeof a.desc === 'string' && a.desc.length > 0));
  assert.equal(out.moneyLabel, '灵石');
});

test('mergeModContent_customAttrs整表替换_不保留旧未命名', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const merged = gen.mergeModContent(
    {
      customAttrs: [
        { id: 'old', label: '未命名', init: 0, min: 0, max: 10 },
        { id: 'keep', label: '旧洞察', init: 1, min: 0, max: 10 },
      ],
    },
    {
      customAttrs: [
        { id: 'a', label: '洞察', init: 3, min: 0, max: 10, desc: '觉察力。' },
        { id: 'b', label: '胆识', init: 4, min: 0, max: 10, desc: '勇气。' },
        { id: 'c', label: '交际', init: 5, min: 0, max: 10, desc: '社交。' },
      ],
    },
  );
  assert.equal(merged.customAttrs.length, 3);
  assert.deepEqual(merged.customAttrs.map((a) => a.label), ['洞察', '胆识', '交际']);
  assert.ok(!merged.customAttrs.some((a) => a.label === '未命名' || a.label === '旧洞察'));
});

test('softValidateBatchPatch_creation至少1条有名属性', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  assert.match(
    String(gen.softValidateBatchPatch(['creation'], { customAttrs: [{ id: 'a', label: '未命名', init: 1 }] }) || ''),
    /建角属性/,
  );
  const ok = gen.ensureWorldGenCustomAttrs(
    { customAttrs: [{ id: 'a', label: '洞察', init: 1, min: 0, max: 10 }] },
    { setting: '旅馆悬疑' },
  );
  assert.equal(gen.softValidateBatchPatch(['creation'], ok), null);
});

test('世界生成提示与向导_要求3条有名属性且货币名', () => {
  const gen = read('lib/worldGenGenerate.ts');
  const lean = read('lib/worldGenProgressDetail.ts');
  const attrsEd = read('components/ModAttrsEditor.tsx');
  const editor = read('components/ModCreationFieldsEditor.tsx');
  assert.match(gen, /WORLD_GEN_CUSTOM_ATTRS_COUNT/);
  assert.match(gen, /normalizeWorldGenCustomAttrs/);
  assert.match(gen, /ensureWorldGenCustomAttrs/);
  assert.match(gen, /ensureWorldGenStartMoney/);
  assert.match(gen, /建议约 2–4 条/);
  assert.match(gen, /moneyLabel/);
  assert.match(gen, /k === "customAttrs"/);
  assert.match(lean, /customAttrs 建议约 2–4 条/);
  assert.match(attrsEd, /属性说明/);
  assert.doesNotMatch(attrsEd, />投骰子</);
  assert.match(attrsEd, /type="checkbox"/);
  assert.match(attrsEd, /固定数值/);
  assert.match(editor, /Badge tone="gold">必填/);
  assert.match(editor, /货币名称/);
  assert.doesNotMatch(editor, /Badge tone="jade">货币/);
});
