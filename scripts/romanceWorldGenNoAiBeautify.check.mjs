/**
 * 回归：开局封面 / 手机应用配置 / 皮肤美化不进 AI 勾选、不占生成次数；
 * 封面只用剧本名替换默认标题，AI 补丁不得改写 cover/theme/phoneAppsCfg。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenNoAiBeautify_勾选清单与分组不含三项', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  for (const id of wiz.WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS) {
    assert.ok(!wiz.ALL_WORLD_GEN_EDITOR_STEP_IDS.includes(id), id);
    assert.ok(!wiz.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === id), id);
  }
  const tier = wiz.groupWorldGenEditorStepsByTier();
  const rendered = [...tier.core, ...tier.extended].flatMap((g) => g.steps.map((s) => s.id));
  for (const id of ['cover', 'phoneAppsCfg', 'theme']) {
    assert.ok(!rendered.includes(id), id);
  }
  // ⑤ 美化：开场剧情仍在步骤表（不进默认生成）+ 音乐 / 剧情美化等；不得再列封面三项
  const look = wiz.WORLD_GEN_EDITOR_STEPS.filter((s) => s.group === '⑤ 美化').map((s) => s.id);
  assert.deepEqual(look, ['opening', 'bgm', 'audioRefs', 'lookRules', 'navTabs']);
  assert.ok(!wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.includes('opening'));
});

test('worldGenNoAiBeautify_草稿封面标题取剧本名_其余美化不预写', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  assert.deepEqual(wiz.worldGenDefaultCover(' 雾港来信 '), { title: '雾港来信' });
  assert.deepEqual(wiz.worldGenDefaultCover(''), { title: '' });
  const draft = wiz.draftModFromWorldGen({
    title: '卷王剧本',
    setting: '都市校园',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: [...wiz.contentIdsFromEditorSteps(wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS)],
    editorStepIds: [...wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: wiz.WORLD_GEN_SCOPE_VERSION,
  });
  assert.equal(draft.name, '卷王剧本');
  assert.deepEqual(draft.content.cover, { title: '卷王剧本' });
  assert.equal(draft.content.theme, undefined);
  assert.equal(draft.content.phoneAppsCfg, undefined);
});

test('worldGenNoAiBeautify_AI补丁剥离美化键_批次不含三项', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const beautify = gen.WORLD_GEN_BATCH_CATEGORIES.find((c) => c.id === 'beautify');
  assert.ok(beautify);
  for (const id of wiz.WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS) {
    assert.ok(!beautify.stepIds.includes(id), id);
  }
  assert.deepEqual([...gen.WORLD_GEN_NO_AI_CONTENT_KEYS], ['cover', 'phoneAppsCfg', 'theme']);

  const patched = gen.sanitizeWorldGenBatchPatch(
    ['lookRules', 'bgm'],
    {
      lookRules: [{ id: 'night', name: '深夜' }],
      cover: { title: 'AI乱改', subtitle: '不该留下' },
      theme: { skin: 'dream' },
      phoneAppsCfg: [{ id: 'wechat', label: '微信' }],
      bgm: [{ id: 'm1' }],
    },
  );
  assert.deepEqual(patched.lookRules, [{ id: 'night', name: '深夜' }]);
  assert.deepEqual(patched.bgm, [{ id: 'm1' }]);
  assert.equal(patched.cover, undefined);
  assert.equal(patched.theme, undefined);
  assert.equal(patched.phoneAppsCfg, undefined);

  // 即使误把 cover 当本批细项，也仍剥离
  const force = gen.sanitizeWorldGenAiPatch('cover', { cover: { title: 'x' }, rooms: { a: { name: 'A' } } });
  assert.equal(force.cover, undefined);
  assert.ok(force.rooms);
});

test('worldGenNoAiBeautify_向导不再展示说明文案_契约仍由代码保证', () => {
  // 功能注释：图注要求删掉顶部说明；封面/美化不进 AI 勾选由 WORLD_GEN_NO_AI_* 契约保证
  const ui = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.doesNotMatch(ui, /开局封面、手机应用配置、皮肤美化固定用引擎默认/);
  assert.doesNotMatch(ui, /不进勾选、不占生成次数/);
  const wiz = readFileSync(join(romance, 'lib/worldGenWizard.ts'), 'utf8');
  assert.match(wiz, /WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS/);
  const gen = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(gen, /WORLD_GEN_NO_AI_CONTENT_KEYS/);
});
