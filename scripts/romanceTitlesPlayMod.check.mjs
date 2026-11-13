/**
 * 头衔拆出养成页：玩法 Mod pack-titles 才显示配置；分档在建角属性。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('playModCatalog_头衔包可选且不含骨架名', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const names = cat.LOCAL_PLAY_MOD_CATALOG.map((x) => x.name).join('|');
  assert.match(names, /头衔包/);
  assert.doesNotMatch(names, /头衔扩展/);
  assert.doesNotMatch(names, /星光|娱乐圈·|青藤校园/);
  const item = cat.catalogBySlug('pack-titles');
  assert.equal(item?.romanceAddonId, 'pack-titles');
  assert.deepEqual(item?.editorPanels, ['titles']);
  const rec = cat.recommendPlayModsFromSetting('需要头衔与称号系统', []);
  assert.ok(rec.some((x) => x.slug === 'pack-titles'));
});

test('entPacks_含pack-titles空表', () => {
  const packs = read('mods/entPacks.ts');
  assert.match(packs, /pack\("pack-titles"/);
  assert.match(packs, /titles: \[\]/);
});

test('ModEditorPanel_卸头衔包清titles_养成无名气分档块', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /patch\.titles = undefined/);
  assert.match(panel, /showPlay\("titles"\)/);
  assert.doesNotMatch(panel, /title="养成规则"/);
  assert.doesNotMatch(panel, /fameTiers: c\.fameTiers/);
  const growHint = panel.slice(panel.indexOf('title="总养成开关"'), panel.indexOf('title="培训课程"'));
  // 功能注释：养成说明保持题材通用，只指向建角定义数值，不再点名题材专用包
  assert.match(growHint, /建角/);
  assert.doesNotMatch(growHint, /娱乐圈/);
});

test('worldGen_无growRules有titles步骤', () => {
  const wiz = read('lib/worldGenWizard.ts');
  assert.doesNotMatch(wiz, /id: "growRules"/);
  assert.match(wiz, /id: "titles"/);
  assert.match(wiz, /growRules: \["creation", "titles"\]/);
  const gen = read('lib/worldGenGenerate.ts');
  assert.doesNotMatch(gen, /"growRules"/);
  assert.match(gen, /"titles"/);
  assert.match(gen, /titles: \["titles"\]/);
});
