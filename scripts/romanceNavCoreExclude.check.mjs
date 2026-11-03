/**
 * 档案 / 支线是游戏本体：不进可配置底栏，也不进玩法 Mod 目录。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('navTabsConfig_池与默认序不含档案支线_旧配置被剔除', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/navTabsConfig.ts')).href);
  assert.deepEqual([...mod.CORE_EXCLUDED_NAV_IDS], ['sim', 'quest']);
  assert.equal(mod.isCoreExcludedNavId('sim'), true);
  assert.equal(mod.isCoreExcludedNavId('quest'), true);
  assert.equal(mod.isCoreExcludedNavId('phone'), false);

  const pool = mod.buildNavPool({ industryTab: true, phone: true, imageCrisis: true });
  assert.ok(!pool.some((p) => p.id === 'sim' || p.id === 'quest'));
  assert.ok(pool.every((p) => !mod.isCoreExcludedNavId(p.id)));
  assert.ok(!mod.DEFAULT_NAV_ORDER.includes('sim'));
  assert.ok(!mod.DEFAULT_NAV_ORDER.includes('quest'));

  const slots = mod.resolveNavSlots(
    pool,
    [
      { id: 'home', on: true },
      { id: 'sim', on: true },
      { id: 'quest', on: true },
      { id: 'phone', label: '灵犀', on: true },
    ],
    4,
  );
  assert.ok(!slots.some((s) => s.id === 'sim' || s.id === 'quest'));
  assert.ok(slots.some((s) => s.id === 'phone' && s.label === '灵犀'));

  const packed = mod.compactNavConfig(
    [
      { id: 'home', on: true },
      { id: 'sim', on: true },
      { id: 'quest', on: false },
      { id: 'npc', on: true },
      { id: 'phone', on: true },
      { id: 'settings', on: true },
    ],
    4,
    pool.length,
  );
  assert.ok(!(packed.navTabs ?? []).some((t) => t.id === 'sim' || t.id === 'quest'));
});

test('MudChrome与编辑器列表_不得再列出档案支线', () => {
  const chrome = read('components/MudChrome.tsx');
  const poolStart = chrome.lastIndexOf('底栏可选牌位', chrome.indexOf('export function navPool'));
  const poolFn = chrome.slice(poolStart >= 0 ? poolStart : chrome.indexOf('export function navPool'), chrome.indexOf('export const navSizes'));
  assert.doesNotMatch(poolFn, /id:\s*"sim"/);
  assert.doesNotMatch(poolFn, /id:\s*"quest"/);
  assert.match(poolFn, /档案 \/ 支线是本体入口/);

  const ed = read('components/NavTabsModEditor.tsx');
  assert.match(ed, /档案与支线是本体入口，不在此列表/);

  const panel = read('components/ModEditorPanel.tsx');
  assert.doesNotMatch(panel, /页签 · 档案/);
  assert.match(panel, /档案与支线是游戏本体/);
  assert.match(panel, /可选玩法在「① 基础 → 已添加的玩法」|玩法是给本剧加的可选内容/);
});

test('playModCatalog_禁止把档案支线当玩法组件', () => {
  const cat = read('mods/playModCatalog.ts');
  assert.match(cat, /不是游戏本体|本体功能不进本目录/);
  assert.doesNotMatch(cat, /defaultNavLabel:\s*"档案"/);
  assert.doesNotMatch(cat, /defaultNavLabel:\s*"支线"/);
  assert.doesNotMatch(cat, /name:\s*"档案"/);
  assert.doesNotMatch(cat, /name:\s*"支线"/);

  const add = read('components/AddPlayModModal.tsx');
  assert.match(add, /不是档案、支线/);
});

test('sanitizeModStrings_应剔除旧底栏档案支线', () => {
  const src = read('lib/sanitizeModStrings.ts');
  assert.match(src, /id !== "sim" && id !== "quest"/);
});
