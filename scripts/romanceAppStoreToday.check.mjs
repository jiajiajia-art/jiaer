/**
 * C3 应用商店「今天」推送：careerDay 种子抽最多 3 个未装非 widget；详情去假数据。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('pickTodayFeaturedIds_确定性抽最多3且跳过已装与widget', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/appStoreToday.ts')).href);
  const catalog = [
    { id: 'a' },
    { id: 'b', kind: 'widget' },
    { id: 'c' },
    { id: 'd' },
    { id: 'e' },
  ];
  const day1 = mod.pickTodayFeaturedIds(catalog, new Set(['a']), 12, 3);
  assert.equal(day1.length, 3);
  assert.ok(!day1.includes('a'));
  assert.ok(!day1.includes('b'));
  assert.deepEqual(mod.pickTodayFeaturedIds(catalog, new Set(['a']), 12, 3), day1);
  const day2 = mod.pickTodayFeaturedIds(catalog, new Set(['a']), 13, 3);
  // 功能注释：换生涯日应允许结果不同；至少集合算法仍合法
  assert.equal(day2.length, 3);
  assert.deepEqual(mod.pickTodayFeaturedIds(catalog, new Set(['a', 'c', 'd', 'e']), 1, 3), []);
  assert.deepEqual(mod.pickTodayFeaturedIds([{ id: 'only' }], new Set(), 1, 3), ['only']);
});

test('UtilApps与Phone_今天算法与详情去假字段', () => {
  const util = read('Romance/src/components/phone/UtilApps.tsx');
  const phone = read('Romance/src/components/Phone.tsx');
  assert.match(util, /pickTodayFeaturedIds/);
  assert.match(util, /今天没有新推荐/);
  assert.doesNotMatch(util, /["']STAR Studio["']|>STAR Studio</);
  assert.doesNotMatch(util, /["']4\+["']/);
  assert.doesNotMatch(util, /k:\s*["']年龄["']/);
  assert.match(phone, /size:\s*["']["']/);
  assert.doesNotMatch(phone, /size:\s*author/);
});
