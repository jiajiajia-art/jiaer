/**
 * 人物生成/编辑三处改动：
 * 1) 卡片数值整块删除
 * 2) AI 姓名须有名有姓（禁太皇太后类纯身份）
 * 3) 所属势力不得出现「已失效」，只能绑当前作品仍存在的势力
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('ContactsPanel_无卡片数值区块与添加数值', () => {
  const panel = read('components/ContactsPanel.tsx');
  assert.match(panel, /关系档位/);
  assert.doesNotMatch(panel, /卡片数值\s*[·・]|添加数值/);
  assert.doesNotMatch(panel, /CONTACT_ICONS|ContactMetric|setMetric/);
  assert.match(panel, /metrics:\s*\[\]/);
});

test('contacts_normalize强制空metrics_visible恒空', () => {
  const src = read('game/contacts.ts');
  assert.match(src, /metrics:\s*\[\]/);
  assert.match(src, /卡片数值已下线|恒返回空/);
  assert.doesNotMatch(src, /metrics\.length \? metrics :/);
});

test('npcEditor_姓名须有名有姓_势力无已失效选项', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /须有名有姓/);
  assert.match(panel, /improperPersonNameReason/);
  assert.match(panel, /sanitizeNpcFactionId/);
  // 功能注释：人物势力下拉不得再渲染「已失效」占位项（线路 hero/room 的已失效不在此禁）
  assert.doesNotMatch(panel, /factionId\}（已失效）|n\.factionId\}.*已失效/);
  assert.doesNotMatch(panel, /\{n\.factionId\}（已失效）/);
  assert.doesNotMatch(panel, /hint="[^"]*卡片数值/);
});

test('personName_拒绝纯身份_接受姓加名', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/personName.ts')).href);
  assert.equal(mod.isProperPersonName('沈晚晴'), true);
  assert.equal(mod.isProperPersonName('林夏'), true);
  assert.equal(mod.isProperPersonName('太皇太后'), false);
  assert.equal(mod.isProperPersonName('掌门'), false);
  assert.equal(mod.isProperPersonName('厨娘'), false);
  assert.match(String(mod.improperPersonNameReason('太皇太后') || ''), /有名有姓/);
  assert.equal(mod.improperPersonNameReason('沈晚晴'), null);
  assert.equal(mod.sanitizeNpcFactionId('faction-royal', ['royal']), undefined);
  assert.equal(mod.sanitizeNpcFactionId('royal', ['royal']), 'royal');
  assert.equal(mod.sanitizeNpcFactionId('royal', new Set()), undefined);
});

test('worldGen_人物契约含有名有姓与势力清洗', () => {
  const gen = read('lib/worldGenGenerate.ts');
  assert.match(gen, /有名有姓|有姓有名/);
  assert.match(gen, /太皇太后/);
  assert.match(gen, /improperPersonNameReason/);
  assert.match(gen, /sanitizeNpcFactionId/);
  assert.match(gen, /kind = "roam"|kind 一律 roam|n\.kind = "roam"/);
  assert.match(gen, /禁止写 metrics\/卡片数值|contacts\.metrics = \[\]/);
});

test('pathsAI_人物强制roam且提示有名有姓', () => {
  const paths = read('components/ModPathsEditor.tsx');
  assert.match(paths, /有姓有名|有名有姓/);
  assert.match(paths, /kind: "roam"/);
  assert.match(paths, /improperPersonNameReason/);
  assert.match(paths, /sanitizeNpcFactionId/);
});

test('sanitizeModStrings_清除失效势力绑定', () => {
  const src = read('lib/sanitizeModStrings.ts');
  assert.match(src, /sanitizeNpcFactionId/);
  assert.match(src, /失效势力/);
});
