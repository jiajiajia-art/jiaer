/**
 * 关系玩法内置②角色：表白/婚礼/伴侣加成可配；
 * 不预置牵线「可用方式」，不引导改 relations.bridge.modes JSON。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('关系玩法_内置②角色Section_非独立玩法包', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const catalog = read('Romance/src/mods/playModCatalog.ts');
  const wizard = read('Romance/src/lib/worldGenWizard.ts');

  assert.match(panel, /g="role"[\s\S]{0,80}title="关系玩法"/);
  assert.match(panel, /ModRelationsEditor/);
  assert.doesNotMatch(panel, /g="base"[\s\S]{0,80}title="关系玩法"/);
  // 功能注释：不得作为「已添加的玩法」可装卸包出现
  assert.doesNotMatch(catalog, /关系玩法|pack-relations|slug:\s*["']relations["']/);
  assert.match(wizard, /id:\s*"relations",\s*group:\s*"② 角色"/);
});

test('关系编辑器_无可用方式预置与JSON指引_保留表白婚礼伴侣', () => {
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
  assert.match(editor, /内置于②角色|人物页的表白、婚礼按这里的数值/);
});

test('运行时_牵线无引擎五种预置_仅显式modes生效', () => {
  const bridge = read('Romance/src/game/bridge.ts');
  assert.doesNotMatch(bridge, /label:\s*"介绍认识"/);
  assert.doesNotMatch(bridge, /label:\s*"三人同行"/);
  assert.doesNotMatch(bridge, /label:\s*"撮合"/);
  assert.doesNotMatch(bridge, /label:\s*"劝和"/);
  assert.doesNotMatch(bridge, /label:\s*"挑拨"/);
  assert.doesNotMatch(bridge, /const DEFAULTS/);
  assert.match(bridge, /不再预置|仅返回创作者显式配置/);
  assert.match(bridge, /for \(const id of Object\.keys\(over\)\)/);

  const npc = read('Romance/src/components/NpcTab.tsx');
  assert.match(npc, /!order\.length\) return null/);
  assert.doesNotMatch(npc, /useState<BridgeMode>\("intro"\)/);
});

test('生成提示_勿让AI预置牵线方式', () => {
  const gen = read('Romance/src/lib/worldGenGenerate.ts');
  assert.match(gen, /relations:[\s\S]{0,200}勿写[\s\S]{0,80}bridge\.modes|relations:[\s\S]{0,200}勿写介绍认识/);
});
