/** 关系玩法本体、可选玩法目录和旧包兼容回归。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { readBackend, skipNoBackend } from './_backendRepo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('关系玩法_在基础区直接配置', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const wizard = read('Romance/src/lib/worldGenWizard.ts');

  assert.doesNotMatch(panel, /showPlay\("relations"\)/);
  assert.match(panel, /g="base"[\s\S]{0,120}title="关系玩法"/);
  assert.doesNotMatch(panel, /g="role"[\s\S]{0,80}title="关系玩法"/);
  assert.match(wizard, /id:\s*"relations",\s*group:\s*"① 基础"/);
  assert.doesNotMatch(wizard, /id:\s*"relations",\s*group:\s*"② 角色"/);
});

test('关系编辑器_配置表白婚礼与伴侣加成', () => {
  const editor = read('Romance/src/components/ModRelationsEditor.tsx');
  assert.match(editor, /表白/);
  assert.match(editor, /好感门槛/);
  assert.match(editor, /心动门槛/);
  assert.match(editor, /婚礼费用/);
  assert.match(editor, /伴侣加成/);
  assert.doesNotMatch(editor, /可用方式/);
  assert.doesNotMatch(editor, /介绍认识|三人同行|撮合|劝和|挑拨/);
  assert.doesNotMatch(editor, /BUILTIN|toggleMode/);
  assert.doesNotMatch(editor, /relations\.bridge\.modes|模组 JSON/);
  assert.match(editor, /游戏本体/);
  assert.doesNotMatch(editor, /内置于②角色/);
});

test('运行时_关系玩法无需安装', () => {
  const npc = read('Romance/src/components/NpcTab.tsx');
  const profile = read('Romance/src/components/PersonProfile.tsx');
  const registry = read('Romance/src/mods/registry.ts');
  assert.match(registry, /if \(k === "relationsPlay"\) return true;/);
  assert.match(npc, /feature\("relationsPlay"\)/);
  assert.match(npc, /relationsPlayOn/);
  assert.match(profile, /feature\("relationsPlay"\)/);
  assert.match(profile, /relationsPlayOn && \(/);
  assert.match(npc, /!order\.length\) return null/);
  assert.doesNotMatch(npc, /useState<BridgeMode>\("intro"\)/);
});

test('目录和推荐排除关系包，旧包仍可读取', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  assert.equal(cat.catalogBySlug('pack-relations'), undefined);
  assert.equal(cat.PLAY_MOD_FEATURE_BY_SLUG['pack-relations'], undefined);
  assert.ok(!cat.recommendPlayModsFromSetting('宫廷恋爱与表白婚礼', []).some((x) => x.slug === 'pack-relations'));
  const modal = read('Romance/src/components/AddPlayModModal.tsx');
  assert.match(modal, /x\.slug !== "pack-relations"/);
  const packs = read('Romance/src/mods/entPacks.ts');
  assert.match(packs, /pack\("pack-relations"/);
  assert.match(packs, /ENT_PACK_IDS[\s\S]*pack-relations/);
});

test('生成提示_勿让AI预置牵线方式', () => {
  const gen = read('Romance/src/lib/worldGenGenerate.ts');
  assert.match(gen, /relations:[\s\S]{0,200}勿写[\s\S]{0,80}bridge\.modes|relations:[\s\S]{0,200}勿写介绍认识/);
  assert.match(gen, /relations: "[^"\n]*游戏本体，直接写/);
  assert.doesNotMatch(gen, /id:\s*"characters"[\s\S]{0,120}"relations"/);
});

test('后端官方种子_含pack-relations', { skip: skipNoBackend }, () => {
  const seed = readBackend('services/playMod/officialPlayModSeed.js');
  assert.match(seed, /slug:\s*'pack-relations'/);
  assert.match(seed, /editor_panels:\s*\[['"]relations['"]\]/);
  assert.match(seed, /romanceAddonId:\s*'pack-relations'/);
});
