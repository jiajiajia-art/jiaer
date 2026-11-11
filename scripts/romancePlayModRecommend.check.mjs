/**
 * 玩法 mod 推荐：按题材建议、不自动安装；未安装不暴露编辑面板。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('recommendPlayModsFromSetting_娱乐题材应推荐事业包且跳过已装', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const hits = cat.recommendPlayModsFromSetting('玩家成为练习生，签约经纪人接通告拍影视。');
  assert.ok(hits.some((x) => x.slug === 'pack-career'));
  assert.ok(hits.some((x) => x.slug === 'pack-image'));

  const after = cat.recommendPlayModsFromSetting('娱乐圈出道', [
    cat.makeInstallFromCatalog(cat.catalogBySlug('pack-career')),
  ]);
  assert.ok(!after.some((x) => x.slug === 'pack-career'));
});

test('recommendPlayModsFromSetting_无关题材可为空', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const hits = cat.recommendPlayModsFromSetting('玩家继承海边旅店，与旅客闲聊。');
  assert.equal(hits.length, 0);
});

test('resolveInstalledEditorPanels_未安装不暴露通告孕育', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const empty = cat.resolveInstalledEditorPanels(undefined);
  assert.equal(empty.has('gigs'), false);
  assert.equal(empty.has('pregnancy'), false);
  assert.equal(empty.has('travel'), false);

  const withCareer = cat.resolveInstalledEditorPanels([
    cat.makeInstallFromCatalog(cat.catalogBySlug('pack-career')),
  ]);
  assert.equal(withCareer.has('gigs'), true);
  assert.equal(withCareer.has('pregnancy'), false);

  const withTravel = cat.resolveInstalledEditorPanels([
    cat.makeInstallFromCatalog(cat.catalogBySlug('pack-transport')),
  ]);
  assert.equal(withTravel.has('travel'), true);
  assert.equal(withTravel.has('cars'), false);
});

test('recommendPlayModsFromSetting_交通题材应推荐出行包', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const hits = cat.recommendPlayModsFromSetting('都市通勤，公交地铁打车怎么去都要算车费。');
  assert.ok(hits.some((x) => x.slug === 'pack-transport'));
});

test('ModEditorPanel_须含玩法推荐确认安装文案', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(panel, /recommendPlayModsFromSetting/);
  assert.match(panel, /确认添加|按当前题材推荐/);
  assert.match(wiz, /DEFAULT_WORLD_GEN_EDITOR_STEP_IDS|全选基础/);
  // 功能注释：扩展玩法不在生成世界勾选，改走编辑器「添加玩法」
  assert.doesNotMatch(wiz, /展开扩展玩法/);
  assert.doesNotMatch(wiz, /含扩展全选/);
});
