/**
 * 作者预览纯净度（R16）：预览只吃当前表单草稿，表单没写的娱乐圈默认不得冒出来。
 * - 货币名缺省「钱」，不回落「片酬」
 * - 开局日志不写「天光小区 / 出道倒计时」，按本作品开局地点
 * - 个人能力：非娱乐圈作品没写 stats.order 不补八维演技
 * - 随机建角描述只读作品 creation 配置，不回落「出道倒计时」
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('货币名缺省为钱_不回落片酬', async () => {
  const live = await import(pathToFileURL(join(romance, 'mods/live.ts')).href);
  assert.equal(live.termFallback('money'), '钱');
  assert.notEqual(live.termFallback('money'), '片酬');
  const reg = read('mods/registry.ts');
  assert.match(reg, /return fallback\?\.trim\(\) \|\| "钱"/);
  assert.doesNotMatch(reg, /return fallback\?\.trim\(\) \|\| "片酬"/);
});

test('createGame开局日志_按本作品开局地点_不写天光小区与出道倒计时', () => {
  const logic = read('game/logic.ts');
  const at = logic.indexOf('export function createGame');
  // 功能注释：去掉整行注释再断言，注释里可以点名旧文案
  const body = logic.slice(at, logic.indexOf('\n}\n', at)).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.match(body, /worldLocOf\(getWorldStartRoom\(\)\)/);
  assert.doesNotMatch(body, /天光小区/);
  assert.doesNotMatch(body, /出道倒计时/);
});

test('个人能力_非娱乐圈没写stats_order不补八维', () => {
  const data = read('game/data.ts');
  const at = data.indexOf('export const dossierStatKeys');
  const body = data.slice(at, data.indexOf('export const ALL_STAT_KEYS', at));
  // 功能注释：没写 stats.order 一律不补内置八维（娱乐圈原版自身也是 order: [] 且隐藏八维）
  assert.match(body, /if \(ordered\.length\) return ordered;/);
  assert.match(body, /return \[\];/);
  assert.doesNotMatch(body, /RAW_STAT_ORDER/);
  const fields = read('components/personFields.tsx');
  assert.match(fields, /本作品尚未配置个人能力/);
});

test('随机建角描述_只读作品creation配置_空就空', () => {
  const store = read('lib/store.ts');
  assert.match(store, /const cc = creationCopy\(\)/);
  assert.match(store, /\(cc\.seedDescription \?\? ""\)\.replace/);
  const data = read('game/data.ts');
  // 功能注释：娱乐圈默认句只存在于 RAW_CREATION；creationCopy 对模组世界回落 {}（slot 第三参）
  assert.match(data, /slot<CreationCopy>\("creation", \(\) => RAW_CREATION, \(\) => \(\{\}\)\)/);
});
