/**
 * 「本次需要 AI 生成的模组」UI 契约（图注）：
 * - 删除顶部说明文字，不展示给创作者
 * - 删除「展开扩展玩法」整块；孕育/通告/座驾等不得在此勾选生成
 * - 扩展玩法只走编辑器「添加玩法」；此处只保留基础世界项
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const wizUi = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');

test('生成模组区_删除顶部说明与扩展玩法展开块', () => {
  const idx = wizUi.indexOf('本次需要 AI 生成的模组');
  assert.ok(idx >= 0);
  const section = wizUi.slice(idx, wizUi.indexOf('world-gen-dock', idx));

  assert.doesNotMatch(section, /首次默认只生成基础世界/);
  assert.doesNotMatch(section, /玩法组件、孕育、通告、座驾/);
  assert.doesNotMatch(section, /可在下方展开后自行勾选/);
  assert.doesNotMatch(section, /展开扩展玩法/);
  assert.doesNotMatch(section, /收起扩展玩法/);
  assert.doesNotMatch(section, /含扩展全选/);
  assert.doesNotMatch(section, /selectAllIncludingExtended/);
  assert.doesNotMatch(section, /showExtendedModules/);
  assert.doesNotMatch(section, /tieredModules\.extended/);

  assert.match(section, /全选基础/);
  assert.match(section, /取消全选/);
  assert.match(section, /基础世界（默认）/);
  assert.match(section, /tieredModules\.core/);
  assert.match(section, /已选 \{selectedCount\}\/\{allCount\}/);
  assert.doesNotMatch(section, /基础默认 \{coreCount\}/);
});

test('规范化_扩展玩法id一律剥掉只留基础世界', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const base = {
    title: '雾港来信',
    setting: '海边旅店。',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: [],
  };
  const mixed = mod.normalizeWorldGenStep1({
    ...base,
    editorStepIds: ['prompt', 'npcs', 'pregnancy', 'gigs', 'cars', 'playModInstalls'],
    scopeVersion: mod.WORLD_GEN_SCOPE_VERSION,
  });
  assert.deepEqual(mixed.editorStepIds, ['prompt', 'npcs']);
  for (const id of ['pregnancy', 'gigs', 'cars', 'playModInstalls']) {
    assert.ok(!mixed.editorStepIds.includes(id), id);
  }

  assert.match(
    mod.validateWorldGenStep1({ ...base, editorStepIds: ['prompt', 'cars'] }) || '',
    /添加玩法/,
  );
  assert.equal(mod.validateWorldGenStep1({ ...base, editorStepIds: ['prompt', 'npcs'] }), null);
});

test('勾选切换_只允许基础世界id', () => {
  assert.match(wizUi, /isWorldGenCoreStep\(id\)/);
  assert.match(wizUi, /DEFAULT_WORLD_GEN_EDITOR_STEP_IDS\.filter/);
  assert.doesNotMatch(wizUi, /ALL_WORLD_GEN_EDITOR_STEP_IDS\.filter/);
});
