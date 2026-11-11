/**
 * 回归：生成世界「禁止生成」字段——与故事设定分离、进生成/补全提示、
 * AI 整理不得改写、写入 prompt.extraRules、AI 补丁不得覆盖。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenForbid_默认与规范化补空串', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  assert.equal(wiz.WORLD_FORBID_MAX, 2000);
  assert.equal(wiz.defaultWorldGenStep1().forbidGen, '');
  const n = wiz.normalizeWorldGenStep1({
    title: '雾港',
    setting: '海边',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: ['prompt'],
  });
  assert.equal(n.forbidGen, '');
  assert.equal(
    wiz.normalizeWorldGenStep1({ ...n, forbidGen: '不要血腥' }).forbidGen,
    '不要血腥',
  );
});

test('worldGenForbid_格式块与校验上限', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const field = await import(pathToFileURL(join(romance, 'lib/worldGenSettingField.ts')).href);
  assert.equal(wiz.formatWorldGenForbidBlock(''), '');
  assert.equal(wiz.formatWorldGenForbidBlock('  '), '');
  assert.match(wiz.formatWorldGenForbidBlock('不要娱乐圈'), /【禁止生成】/);
  assert.match(wiz.formatWorldGenForbidBlock('不要娱乐圈'), /不要娱乐圈/);

  assert.equal(field.isWorldGenForbidOverLimit('x'.repeat(2000)), false);
  assert.equal(field.isWorldGenForbidOverLimit('x'.repeat(2001)), true);

  const base = {
    title: '雾港来信',
    setting: '正常设定',
    forbidGen: '字'.repeat(2001),
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: ['prompt'],
    scopeVersion: wiz.WORLD_GEN_SCOPE_VERSION,
  };
  assert.equal(wiz.validateWorldGenStep1(base), '禁止生成最多 2000 字');
  assert.equal(wiz.validateWorldGenStep1({ ...base, forbidGen: '不要血腥' }), null);
});

test('worldGenForbid_AI整理提示不改禁止清单', async () => {
  const field = await import(pathToFileURL(join(romance, 'lib/worldGenSettingField.ts')).href);
  assert.match(field.worldGenAiPolishPrompt(true), /禁止生成/);
  assert.match(field.worldGenAiPolishPrompt(true), /原样保留|不要整理/);
  assert.match(field.worldGenAiPolishPrompt(false), /禁止生成/);
  assert.equal(field.worldGenForbidPrompt(''), '');
  assert.match(field.worldGenForbidPrompt('不要未成年恋爱'), /【禁止生成】/);
  assert.match(field.worldGenForbidPrompt('不要未成年恋爱'), /硬性禁止/);
});

test('worldGenForbid_落模组extraRules且生成提示注入', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '月色如墨',
    setting: '小镇女孩遇到男主',
    forbidGen: '不要现代通告；不要血腥',
  };
  const mod = wiz.draftModFromWorldGen(draft);
  assert.match(mod.content.prompt.extraRules, /【禁止生成】/);
  assert.match(mod.content.prompt.extraRules, /不要现代通告/);
  // 功能注释：故事设定不再进 worldIntro；短设定可作简介；剧本基调留给 AI
  assert.equal(mod.content.prompt.worldIntro, undefined);
  assert.equal(mod.description, '小镇女孩遇到男主');
  assert.equal(mod.content.prompt.scriptTone, undefined);

  const empty = wiz.draftModFromWorldGen({ ...draft, forbidGen: '  ' });
  assert.equal(empty.content.prompt.extraRules, undefined);

  const applied = gen.applyWorldGenForbidToContent(
    { prompt: { worldIntro: 'x', scriptTone: '基调' } },
    '不要出现车祸',
  );
  assert.equal(applied.prompt.worldIntro, 'x');
  assert.equal(applied.prompt.scriptTone, '基调');
  assert.match(applied.prompt.extraRules, /不要出现车祸/);

  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(src, /worldGenForbidPrompt/);
  assert.match(src, /applyWorldGenForbidToContent/);
  assert.match(src, /extraRules/);
  assert.match(src, /k === ["']extraRules["']/);
});

test('worldGenForbid_UI位于故事设定与AI整理之间', () => {
  const ui = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  // 功能注释：故事设定标签后接必填红星，不能再用 >故事设定< 紧邻匹配
  const settingIdx = ui.search(/故事设定\s*<span className="world-gen-req"/);
  const forbidIdx = ui.indexOf('<span>禁止生成</span>');
  const polishIdx = ui.indexOf('由 AI 整理设定');
  assert.ok(settingIdx > 0 && forbidIdx > settingIdx, '禁止生成应在故事设定下方');
  assert.ok(polishIdx > forbidIdx, 'AI 整理应在禁止生成下方');
  assert.match(ui, /forbidGen/);
  assert.match(ui, /WORLD_FORBID_MAX/);
  assert.match(ui, /不会被「由 AI/);
  assert.doesNotMatch(ui, /内容禁区/);

  const paths = readFileSync(join(romance, 'components/ModPathsEditor.tsx'), 'utf8');
  assert.match(paths, /extraRules/);
  assert.match(paths, /禁止项不得出现/);
});
