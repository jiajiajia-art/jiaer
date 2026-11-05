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
  assert.equal(m.isProperPersonName(''), false);
  assert.match(m.improperPersonNameReason('厨娘') || '', /有名有姓/);
  assert.equal(m.improperPersonNameReason('沈晚晴'), null);
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
  assert.match(gen, /contacts\.metrics = \[\]|delete contacts\.metrics/);
  assert.match(gen, /sanitizeNpcFactionId/);
});
