/**
 * 底栏页签：terms/label 为对象时不得 .trim 崩页
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('buildNavPool_terms值为对象时不抛trim', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/navTabsConfig.ts')).href);
  const pool = mod.buildNavPool({}, { tabWorld: { bad: 1 }, tabNpc: 12 });
  assert.ok(Array.isArray(pool) && pool.length >= 4);
  assert.equal(pool.find((p) => p.id === 'home')?.label, '世界');
  const fromTerms = mod.navTabsFromTerms({ tabWorld: { x: 1 }, tabPhone: ' 手机 ' });
  assert.deepEqual(fromTerms, [{ id: 'phone', label: '手机', on: true }]);
  const warn = mod.navConfigWarnings([{ id: 'home', label: { t: '超长名字啊' }, on: true }], 4, 8);
  assert.equal(warn.length, 0); // 非字符串当空名，不报超长
});

test('navTabsConfig_源码禁止terms可选链直接trim', () => {
  const src = readFileSync(join(romance, 'lib/navTabsConfig.ts'), 'utf8');
  assert.match(src, /function navText/);
  assert.doesNotMatch(src, /terms\?\.\[tk\]\?\.trim\(\)/);
  assert.doesNotMatch(src, /terms\[tk\]\?\.trim\(\)/);
  assert.doesNotMatch(src, /c\.label\?\.trim\(\)/);
});
