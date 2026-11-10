/**
 * 人物姓名：须有名有姓；势力 id 只能绑现存 startFactions。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('isProperPersonName_沈晚晴过_太皇太后厨娘不过', async () => {
  const m = await import(pathToFileURL(join(romance, 'lib/personName.ts')).href);
  assert.equal(m.isProperPersonName('沈晚晴'), true);
  assert.equal(m.isProperPersonName('苏婉清'), true);
  assert.equal(m.isProperPersonName('欧阳娜娜'), true);
  assert.equal(m.isProperPersonName('太皇太后'), false);
  assert.equal(m.isProperPersonName('厨娘'), false);
  assert.equal(m.isProperPersonName('掌门'), false);
  assert.equal(m.isProperPersonName('夜班房客'), false);
  assert.equal(m.isProperPersonName('店员'), false);
  assert.equal(m.isProperPersonName(''), false);
  assert.match(m.improperPersonNameReason('厨娘') || '', /有名有姓/);
  assert.match(m.improperPersonNameReason('夜班房客') || '', /有名有姓/);
  assert.equal(m.improperPersonNameReason('沈晚晴'), null);
});

test('healNpcNameFields_夜班房客应挪到role并补真名', async () => {
  const m = await import(pathToFileURL(join(romance, 'lib/personName.ts')).href);
  const avoid = new Set();
  const h = m.healNpcNameFields({ name: '夜班房客', role: '', gender: '女' }, avoid);
  assert.equal(h.healed, true);
  assert.equal(h.role, '夜班房客');
  assert.equal(m.isProperPersonName(h.name), true);
  assert.ok(avoid.has(h.name));
  const keep = m.healNpcNameFields({ name: '林晚舟', role: '常驻房客', gender: '男' }, avoid);
  assert.equal(keep.healed, false);
  assert.equal(keep.name, '林晚舟');
  assert.equal(keep.role, '常驻房客');
});

test('healNpcListNames_应自愈身份占位且不撞名', async () => {
  const m = await import(pathToFileURL(join(romance, 'lib/personName.ts')).href);
  const { npcs, healedCount } = m.healNpcListNames([
    { id: 'a', name: '夜班房客', gender: '女', bio: 'x'.repeat(30) },
    { id: 'b', name: '店员', gender: '男', bio: 'y'.repeat(30) },
    { id: 'c', name: '沈晚晴', gender: '女', bio: 'z'.repeat(30) },
  ]);
  assert.equal(healedCount, 2);
  assert.equal(m.isProperPersonName(npcs[0].name), true);
  assert.equal(npcs[0].role, '夜班房客');
  assert.equal(m.isProperPersonName(npcs[1].name), true);
  assert.equal(npcs[1].role, '店员');
  assert.equal(npcs[2].name, '沈晚晴');
  assert.notEqual(npcs[0].name, npcs[1].name);
});

test('sanitizeNpcFactionId_只保留现存势力', async () => {
  const m = await import(pathToFileURL(join(romance, 'lib/personName.ts')).href);
  const ids = new Set(['fac_a', 'fac_b']);
  assert.equal(m.sanitizeNpcFactionId('fac_a', ids), 'fac_a');
  assert.equal(m.sanitizeNpcFactionId('faction-royal', ids), undefined);
  assert.equal(m.sanitizeNpcFactionId('fac_a', []), undefined);
  assert.equal(m.sanitizeNpcFactionId('', ids), undefined);
});

test('npcEditor_势力下拉无已失效选项', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /\$\{n\.factionId\}（已失效）|factionId\}（已失效）/);
  assert.match(panel, /所属势力（可选）/);
  assert.match(panel, /sanitizeNpcFactionId/);
});

test('worldGen_人物姓名软校验与卡片数值剥离', () => {
  const gen = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(gen, /improperPersonNameReason/);
  assert.match(gen, /有名有姓|沈晚晴/);
  assert.match(gen, /夜班房客/);
  assert.match(gen, /healWorldGenNpcNamesInPatch|healNpcListNames/);
  assert.match(gen, /healMissingContentIds/);
  assert.match(gen, /contacts\.metrics = \[\]|delete contacts\.metrics/);
  assert.match(gen, /sanitizeNpcFactionId/);
});

test('healWorldGenNpcNamesInPatch_应自愈身份占位名', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const person = await import(pathToFileURL(join(romance, 'lib/personName.ts')).href);
  const out = gen.healWorldGenNpcNamesInPatch({
    npcs: [{ id: 'n1', name: '夜班房客', gender: '女', age: 28, bio: 'x'.repeat(40), home: 'lobby' }],
    rooms: { lobby: { name: '前台', desc: '木质柜台靠窗，海风能吹进来。' } },
    startRoom: 'lobby',
  });
  assert.equal(person.isProperPersonName(out.npcs[0].name), true);
  assert.equal(out.npcs[0].role, '夜班房客');
  assert.equal(out.rooms.lobby.name, '前台');
  const soft = gen.softValidateBatchPatch(['npcs', 'rooms'], out);
  assert.equal(soft, null);
});

test('mergeModContent_worldRules缺id合并后应自愈', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const merged = gen.mergeModContent(
    { prompt: { scriptTone: '测' } },
    { worldRules: [{ name: '婚姻' }, { name: '姓氏' }, { name: '生育' }] },
  );
  assert.ok(Array.isArray(merged.worldRules));
  assert.equal(merged.worldRules.length, 3);
  assert.ok(merged.worldRules.every((e) => e && typeof e.id === 'string' && e.id.trim()));
});

test('modWorkshop_合并后应走healWorkshopDraft', () => {
  const src = readFileSync(join(romance, 'components/ModWorkshop.tsx'), 'utf8');
  assert.match(src, /healWorkshopDraft/);
  assert.match(src, /healModBeforeSave/);
  assert.match(src, /healNpcListNames/);
});
