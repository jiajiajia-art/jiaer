/**
 * 关系玩法 = 商店玩法 Mod（pack-relations）：
 * 未添加不出现编辑器配置块，人物页也不出表白/婚礼/牵线入口。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('关系玩法_商店包与编辑器须装后才显示', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const catalog = read('Romance/src/mods/playModCatalog.ts');
  const wizard = read('Romance/src/lib/worldGenWizard.ts');

  assert.match(catalog, /slug:\s*"pack-relations"/);
  assert.match(catalog, /editorPanels:\s*\[["']relations["']\]/);
  assert.match(catalog, /"pack-relations":\s*Object\.freeze\(\["relationsPlay"\]/);
  assert.match(panel, /showPlay\("relations"\)/);
  assert.match(panel, /g="base"[\s\S]{0,120}title="关系玩法"/);
  assert.doesNotMatch(panel, /g="role"[\s\S]{0,80}title="关系玩法"/);
  assert.match(wizard, /id:\s*"relations",\s*group:\s*"① 基础"/);
  assert.doesNotMatch(wizard, /id:\s*"relations",\s*group:\s*"② 角色"/);
});

test('关系编辑器_无可用方式预置_文案标明玩法包', () => {
  const editor = read('Romance/src/components/ModRelationsEditor.tsx');
  assert.match(editor, /表白/);
  assert.match(editor, /好感门槛/);
  assert.match(editor, /心动门槛/);
  assert.match(editor, /婚礼费用/);
  assert.match(editor, /伴侣加成/);
  assert.match(editor, /NPC 牵线/);
  assert.match(editor, /每天次数/);
  assert.doesNotMatch(editor, /可用方式/);
  assert.doesNotMatch(editor, /介绍认识|三人同行|撮合|劝和|挑拨/);
  assert.doesNotMatch(editor, /BUILTIN|toggleMode/);
  assert.doesNotMatch(editor, /relations\.bridge\.modes|模组 JSON/);
  assert.match(editor, /自行添加触发与事件|固定事件/);
  assert.match(editor, /已添加「关系玩法」|关系玩法/);
  assert.doesNotMatch(editor, /内置于②角色/);
});

test('运行时_表白婚礼牵线须feature_relationsPlay', () => {
  const npc = read('Romance/src/components/NpcTab.tsx');
  const profile = read('Romance/src/components/PersonProfile.tsx');
  const registry = read('Romance/src/mods/registry.ts');
  assert.match(registry, /relationsPlay:\s*\(w\)\s*=>\s*w\.content\.features\.relationsPlay === true/);
  assert.match(npc, /feature\("relationsPlay"\)/);
  assert.match(npc, /relationsPlayOn/);
  assert.match(profile, /feature\("relationsPlay"\)/);
  assert.match(profile, /relationsPlayOn && \(/);
  assert.match(npc, /!order\.length\) return null/);
  assert.doesNotMatch(npc, /useState<BridgeMode>\("intro"\)/);
});

test('catalog_推荐与entPack含pack-relations', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const item = cat.catalogBySlug('pack-relations');
  assert.equal(item?.name, '关系玩法');
  assert.ok(item?.editorPanels.includes('relations'));
  assert.deepEqual([...cat.PLAY_MOD_FEATURE_BY_SLUG['pack-relations']], ['relationsPlay']);
  const rec = cat.recommendPlayModsFromSetting('宫廷恋爱与表白婚礼', []);
  assert.ok(rec.some((x) => x.slug === 'pack-relations'));
  const packs = read('Romance/src/mods/entPacks.ts');
  assert.match(packs, /pack\("pack-relations"/);
  assert.match(packs, /ENT_PACK_IDS[\s\S]*pack-relations/);
});

test('生成提示_勿让AI预置牵线方式', () => {
  const gen = read('Romance/src/lib/worldGenGenerate.ts');
  assert.match(gen, /relations:[\s\S]{0,200}勿写[\s\S]{0,80}bridge\.modes|relations:[\s\S]{0,200}勿写介绍认识/);
  assert.match(gen, /playMods[\s\S]{0,400}"relations"/);
  assert.doesNotMatch(gen, /id:\s*"characters"[\s\S]{0,120}"relations"/);
});

test('后端官方种子_含pack-relations', () => {
  const seed = readFileSync(
    join(root, '../Interactive-fiction-backend/services/playMod/officialPlayModSeed.js'),
    'utf8',
  );
  assert.match(seed, /slug:\s*'pack-relations'/);
  assert.match(seed, /editor_panels:\s*\[['"]relations['"]\]/);
  assert.match(seed, /romanceAddonId:\s*'pack-relations'/);
});
