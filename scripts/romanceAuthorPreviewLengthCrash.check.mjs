/**
 * 回归：作者预览封面/建角不得再被 AI 脏数据炸出
 * Cannot read properties of undefined (reading 'length')
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('liveArray_源码须把非数组收成空数组再 Reflect.get', () => {
  const live = read('mods/live.ts');
  assert.match(live, /Array\.isArray\(raw\) \? raw : \[\]/);
  // 功能注释：工厂内 spread 脏对象会先抛；须 try/catch 兜底，否则 liveArray 保护形同虚设
  assert.match(live, /catch\s*\{/);
});

test('WorldRuleCards_options缺失不得直接读length', () => {
  const src = read('components/WorldRulesPanel.tsx');
  assert.match(src, /Array\.isArray\(d\.options\) && d\.options\.length > 0/);
  assert.match(src, /data-world-rule-cards=\"1\"/);
  assert.doesNotMatch(src, /repeat\(\$\{d\.options\.length\}/);
});

test('EntityText_useMemo_缺name不得读length', () => {
  const src = read('components/EntityText.tsx');
  assert.match(src, /namedEnough/);
  assert.match(src, /typeof name === \"string\" && name\.length >= 2/);
  assert.doesNotMatch(src, /\.filter\(\(n\) => n\.name\.length/);
  assert.doesNotMatch(src, /l\.name\.length >= 2/);
});

test('avatarPools_images缺失不得直接读length', () => {
  const src = read('game/avatarPools.ts');
  assert.match(src, /hasImages/);
  assert.match(src, /Array\.isArray\(p\.images\) && p\.images\.length/);
  assert.doesNotMatch(src, /lib\.filter\(\(p\) => p\.images\.length/);
});

test('STAT_ORDER_order须asModArray', () => {
  const data = read('game/data.ts');
  assert.match(data, /asModArray<StatKey>\(statsSlot\(\)\.order\)/);
  assert.match(data, /asModArray<StatKey>\(statsSlot\(\)\.hidden\)/);
});

test('EndingsPanel_脏conds缺kind不得直接读', () => {
  const src = read('components/EndingsPanel.tsx');
  assert.match(src, /typeof \(c as \{ kind\?: unknown \}\)\.kind === \"string\"/);
  assert.match(src, /!d\.src \|\| typeof d\.src\.kind !== \"string\"/);
});

test('ZODIACS_缺from_to须回退引擎表', () => {
  const data = read('game/data.ts');
  assert.match(data, /zodiacEntryOk/);
  assert.match(data, /from\.length >= 2/);
  assert.match(data, /ok\.length \? ok : RAW_ZODIACS/);
});

test('CALENDAR_残缺calendar须合并weekdayNames', () => {
  const src = read('worlds/star2005/content.ts');
  assert.match(src, /weekdayNames\.length/);
  assert.match(src, /WORLD\.calendar\.weekdayNames/);
});

test('beginAuthorPreviewMod_须sanitize后再挂草稿', () => {
  const reg = read('mods/registry.ts');
  const begin = reg.slice(reg.indexOf('export function beginAuthorPreviewMod'), reg.indexOf('export function endAuthorPreviewMod'));
  assert.match(begin, /sanitizeModStrings/);
  // 功能注释：脏 {apps:[]} 仍经 asPhoneOverrides 规整，但 [] 必须保留为「明确没装」，统一走 normalizeWorldPhoneAppsCfg
  assert.match(reg, /normalizeWorldPhoneAppsCfg\(wc\.phoneAppsCfg\)/);
});

test('worldGenStartDate_须丢掉残缺calendar补丁', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenStartDate.ts')).href);
  const out = mod.normalizeWorldGenPatchStartDate({
    calendar: { startDate: '2024年3月15日' },
    travel: { apPerTurn: 3 },
  });
  assert.equal(out.startDate, '2024.03.15');
  assert.equal('calendar' in out, false);
});

test('resolveCoverBg_源码须把非数组cgs收成空再filter', () => {
  const cover = read('components/Cover.tsx');
  assert.match(cover, /Array\.isArray\(c\.cgs\) \? c\.cgs : \[\]/);
});

test('asPhoneOverrides_对象apps可收成数组', async () => {
  const phone = await import(pathToFileURL(join(romance, 'lib/phoneAppsConfig.ts')).href);
  const list = phone.asPhoneOverrides({ apps: [{ id: 'wechat', label: '微信' }] });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'wechat');
  assert.deepEqual(phone.asPhoneOverrides(null), []);
});

test('asModArray_单对象与袋装数组可展开_禁止is not iterable', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/asModArray.ts')).href);
  assert.deepEqual(mod.asModArray(null), []);
  assert.equal(mod.asModArray({ id: 'a', name: '阿宁' }).length, 1);
  assert.equal(mod.asModArray({ npcs: [{ id: 'a' }, { id: 'b' }] }).length, 2);
  assert.equal(mod.asModArray({ attrs: [{ id: 'x', label: '洞察' }] }).length, 1);
  assert.doesNotThrow(() => {
    const rows = mod.asModArray({ id: 'x' });
    void [...rows];
  });
  // 功能注释：模拟旧 resolve 对脏 npcs 直接展开会炸；asModArray 后必须可迭代
  assert.doesNotThrow(() => {
    void [...mod.asModArray({ 0: { id: 'a' }, 1: { id: 'b' } })];
  });
});

test('FIXED_METRICS源码须asModArray收customAttrs_禁止is not iterable', () => {
  const src = read('game/fixedEvents.ts');
  assert.match(src, /asModArray<\s*AttrDef\s*>\(\s*getWorldSlot\(\"customAttrs\"\)\s*\)/);
  assert.doesNotMatch(src, /\.\.\.\(\s*getWorldSlot\(\"customAttrs\"\)\s*\?\?\s*\[\]\s*\)/);
});

test('liveArray_工厂抛错须回落空数组', async () => {
  const live = await import(pathToFileURL(join(romance, 'mods/live.ts')).href);
  const rows = live.liveArray(() => {
    const dirty = { id: 'x' };
    return [...(dirty ?? []), { key: 'ok' }];
  });
  assert.doesNotThrow(() => {
    assert.equal(rows.length, 0);
    assert.deepEqual([...rows], []);
  });
});

test('mergeModContent_customAttrs对象须收成数组', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const merged = gen.mergeModContent(
    { customAttrs: [{ id: 'old', label: '旧' }] },
    { customAttrs: { id: 'a', label: '洞察', init: 1 } },
  );
  assert.ok(Array.isArray(merged.customAttrs));
  assert.equal(merged.customAttrs.length, 1);
  assert.equal(merged.customAttrs[0].label, '洞察');
});

test('registry_resolve路径须对locations_npcs等走asModArray', () => {
  const reg = read('mods/registry.ts');
  assert.match(reg, /asModArray<.*>\(wc\.npcs\)/);
  assert.match(reg, /asModArray<.*>\(wc\.locations\)/);
  assert.match(reg, /asModArray<.*>\(wc\.items\)/);
  assert.match(reg, /asModArray\(wc\.worldBook\)/);
  assert.match(reg, /ensureName/);
  assert.match(reg, /asModArray<string>\(content\.features\.phoneAppsExtra\)/);
  assert.doesNotMatch(reg, /npcs:\s*\[\.\.\.\(wc\.npcs \?\? \[\]\)\]/);
  assert.doesNotMatch(reg, /\[\.\.\.\(content\.features\.phoneAppsExtra \?\? \[\]\)\]/);
});

test('CharacterCreate与性别选项须收非数组_禁止is not iterable', () => {
  const create = read('components/CharacterCreate.tsx');
  const gender = read('game/creationSystemFields.ts');
  assert.match(create, /asModArray/);
  assert.match(create, /asModArray<CreationField>\(cc\.fields\)/);
  assert.match(create, /asModArray<.*>\(cc\.startFactions\)/);
  // 功能注释：禁止再对 chain 上原始 content.npcs 做 flatMap（脏对象 → is not iterable）
  assert.doesNotMatch(create, /chain\.flatMap\(\(m\) => m\.content\.npcs/);
  assert.match(create, /asModArray<.*>\(getSelectedWorld\(\)\.content\.npcs\)/);
  assert.match(gender, /Array\.isArray\(options\)/);
  assert.doesNotMatch(gender, /\(options \?\? \[\]\)\.map/);
});

test('creationText_varsFrom_paths须asModArray', () => {
  const src = read('game/creationText.ts');
  assert.match(src, /asModArray<.*>\(o\.paths\)/);
  assert.doesNotMatch(src, /\(o\.paths \?\? \[\]\)\.filter/);
});

test('sanitize_须清洗startFactions与dependencies', () => {
  const src = read('lib/sanitizeModStrings.ts');
  assert.match(src, /"startFactions"/);
  assert.match(src, /coerceArray\(m\.dependencies\)/);
});

test('BgmPanel与audioLib_bgm须asModArray', () => {
  const bgm = read('components/BgmPanel.tsx');
  const audio = read('game/audioLib.ts');
  assert.match(bgm, /asModArray<ModTrack>\(m\.content\.bgm\)/);
  assert.match(audio, /asModArray<.*>\(m\.content\?\.bgm\)/);
  assert.doesNotMatch(bgm, /\(m\.content\.bgm \?\? \[\]\)\.map/);
  assert.doesNotMatch(audio, /\(m\.content\?\.bgm \?\? \[\]\)\.filter/);
});

test('evalRequires源码须asModArray收requires_禁止is not iterable', () => {
  const src = read('worlds/star2005/content.ts');
  const body = src.slice(src.indexOf('export function evalRequires'), src.indexOf('export function evalRequires') + 700);
  assert.match(body, /asModArray<\s*Requirement\s*>\(reqs\)/);
  assert.doesNotMatch(body, /for \(const r of reqs\)/);
});

test('asModArray_门槛requires单对象与袋装可展开', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/asModArray.ts')).href);
  const one = mod.asModArray({ metric: 'week', op: 'gte', value: 1, hint: '第1周' });
  assert.equal(one.length, 1);
  assert.doesNotThrow(() => { for (const r of one) void r.metric; });
  const bag = mod.asModArray({ 0: { metric: 'fame', op: 'gte', value: 10, hint: '名气' } });
  assert.equal(bag.length, 1);
  assert.doesNotThrow(() => { for (const r of bag) void r.metric; });
});

test('sanitize_须清洗requires数组字段', () => {
  const src = read('lib/sanitizeModStrings.ts');
  assert.match(src, /"requires"/);
  assert.match(src, /"requirements"/);
});
