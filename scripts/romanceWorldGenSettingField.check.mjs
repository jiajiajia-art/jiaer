/**
 * 回归：生成世界故事设定自适应高度、5000 字标红闸门、
 * 勾选 AI 润色 / 未勾选超限截断确认。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenSettingField_超限闸门与截断', async () => {
  const field = await import(pathToFileURL(join(romance, 'lib/worldGenSettingField.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  assert.equal(wiz.WORLD_SETTING_MAX, 5000);
  assert.equal(field.isWorldGenSettingOverLimit('x'.repeat(5000)), false);
  assert.equal(field.isWorldGenSettingOverLimit('x'.repeat(5001)), true);
  assert.equal(field.truncateWorldGenSetting('x'.repeat(5010)).length, 5000);

  assert.deepEqual(field.gateWorldGenSettingSubmit({ setting: '', aiPolish: true }), {
    ok: false,
    error: '请填写故事设定',
  });
  assert.deepEqual(field.gateWorldGenSettingSubmit({ setting: '  \n', aiPolish: false }), {
    ok: false,
    error: '请填写故事设定',
  });

  const short = '玩家是小镇女孩';
  assert.deepEqual(field.gateWorldGenSettingSubmit({ setting: short, aiPolish: false }), {
    ok: true,
    setting: short,
  });

  const over = '字'.repeat(5001);
  assert.deepEqual(field.gateWorldGenSettingSubmit({ setting: over, aiPolish: false }), {
    ok: false,
    needTruncateConfirm: true,
  });
  assert.deepEqual(field.gateWorldGenSettingSubmit({ setting: over, aiPolish: true }), {
    ok: true,
    setting: over,
  });

  assert.match(field.WORLD_GEN_SETTING_TRUNCATE_CONFIRM, /5000/);
  assert.match(field.WORLD_GEN_SETTING_TRUNCATE_CONFIRM, /截断/);
  assert.match(field.worldGenAiPolishPrompt(true), /作品名称/);
  assert.match(field.worldGenAiPolishPrompt(true), /5000/);
  assert.match(field.worldGenAiPolishPrompt(true), /禁止生成/);
  assert.match(field.worldGenAiPolishPrompt(false), /未勾选/);
  assert.match(field.worldGenAiPolishPrompt(false), /禁止生成/);
});

test('worldGenSettingField_校验_勾选AI可超限_未勾选不可', async () => {
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const base = {
    title: '雾港来信',
    setting: '字'.repeat(5001),
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: ['prompt'],
    scopeVersion: wiz.WORLD_GEN_SCOPE_VERSION,
  };
  assert.equal(
    wiz.validateWorldGenStep1({ ...base, aiPolish: false }),
    '故事设定最多 5000 字',
  );
  assert.equal(wiz.validateWorldGenStep1({ ...base, aiPolish: true }), null);
  assert.equal(
    wiz.validateWorldGenStep1({ ...base, setting: '正常设定', aiPolish: false }),
    null,
  );
});

test('worldGenSettingField_自适应高度与UI契约', () => {
  const css = readFileSync(join(romance, 'index.css'), 'utf8');
  assert.match(css, /\.world-gen-textarea\s*\{[^}]*min-height:\s*2\.75rem/s);
  assert.match(css, /\.world-gen-textarea\s*\{[^}]*resize:\s*none/s);
  assert.match(css, /\.world-gen-textarea\s*\{[^}]*field-sizing:\s*content/s);
  assert.doesNotMatch(css, /\.world-gen-textarea\s*\{[^}]*min-height:\s*9rem/s);
  assert.match(css, /\.world-gen-field-count\.is-over/);

  const ui = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(ui, /fitWorldGenSettingTextarea/);
  assert.match(ui, /gateWorldGenSettingSubmit/);
  assert.match(ui, /WORLD_GEN_SETTING_TRUNCATE_CONFIRM/);
  assert.match(ui, /useConfirm/);
  assert.match(ui, /is-over/);
  assert.doesNotMatch(ui, /maxLength=\{WORLD_SETTING_MAX\}/);
  assert.match(ui, /由 AI 整理设定/);
  assert.match(ui, /作品名称也可润色/);
});

test('worldGenSettingField_fitTextarea按scrollHeight', async () => {
  const field = await import(pathToFileURL(join(romance, 'lib/worldGenSettingField.ts')).href);
  const el = {
    style: { height: '' },
    scrollHeight: 120,
  };
  field.fitWorldGenSettingTextarea(el);
  assert.equal(el.style.height, '120px');
  field.fitWorldGenSettingTextarea(null);
  field.fitWorldGenSettingTextarea(undefined);
});

test('worldGenGenerate_使用worldGenAiPolishPrompt', () => {
  const src = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(src, /worldGenAiPolishPrompt/);
  assert.doesNotMatch(src, /若故事设定口语化，请在保留原意前提下整理结构与表达/);
});
