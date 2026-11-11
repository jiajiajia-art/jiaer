/**
 * startMet 规范化：AI 脏数据不得导致「is not iterable」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('normalizeStartMetList_数组字符串对象均可_非法回落undefined', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/normalizeStartMet.ts')).href);
  assert.deepEqual(mod.normalizeStartMetList(['a', 'b', 'a']), ['a', 'b']);
  assert.deepEqual(mod.normalizeStartMetList('linyi, suqing'), ['linyi', 'suqing']);
  assert.deepEqual(mod.normalizeStartMetList({ 0: 'x', 1: 'y' }), ['x', 'y']);
  assert.equal(mod.normalizeStartMetList(null), undefined);
  assert.equal(mod.normalizeStartMetList(12), undefined);
  assert.equal(mod.normalizeStartMetList({}), undefined);
  // 展开安全：规范化后可 spread
  const ids = mod.normalizeStartMetList({ foo: 'a' }) ?? [];
  assert.deepEqual([...ids], ['a']);
});

test('sanitizeWorldGenAiPatch_须规范化startMet', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const cleaned = gen.sanitizeWorldGenAiPatch('npcs', {
    npcs: [{ id: 'a', name: '阿宁' }],
    startMet: { 0: 'a', 1: 'b' },
  });
  assert.deepEqual(cleaned.startMet, ['a', 'b']);
  const dropped = gen.sanitizeWorldGenAiPatch('npcs', { startMet: 3 });
  assert.equal(dropped.startMet, undefined);
});

test('registry_源码合并startMet须走normalize', () => {
  const src = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');
  assert.match(src, /normalizeStartMetList/);
  assert.doesNotMatch(src, /startMet: wc\.startMet \? \[\.\.\.wc\.startMet\]/);
  assert.doesNotMatch(src, /content\.startMet = \[\.\.\.\(content\.startMet \?\? \[\]\), \.\.\.c\.startMet\]/);
  // 功能注释：落盘也须收口，避免脏 startMet 再进 localStorage
  assert.match(src, /export function upsertUserMod[\s\S]*normalizeStartMetList\(content\.startMet\)/);
});
