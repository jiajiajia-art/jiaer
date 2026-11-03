/**
 * 剧本基调：三框并一框，进①基础；旧字按 GM→世界观→口吻接上；发给模型仍是这段。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const lib = await import(pathToFileURL(join(romance, 'lib/scriptTone.ts')).href);
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const registry = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');

test('readScriptTone_优先scriptTone_否则按GM世界观口吻顺序拼接', () => {
  assert.equal(lib.readScriptTone({ scriptTone: '整段' }), '整段');
  assert.equal(
    lib.readScriptTone({ gmIntro: '甲', worldIntro: '乙', narratorPersona: '丙' }),
    '甲\n\n乙\n\n丙',
  );
  assert.equal(lib.readScriptTone({ gmIntro: '甲', narratorPersona: '丙' }), '甲\n\n丙');
  assert.equal(lib.readScriptTone({}), '');
});

test('applyScriptTone_写入后清掉旧三字段_不丢正文', () => {
  const next = lib.applyScriptTone(
    { gmIntro: '旧GM', worldIntro: '旧世界', narratorPersona: '旧口吻', terminology: '术语' },
    '新基调',
  );
  assert.equal(next.scriptTone, '新基调');
  assert.equal(next.gmIntro, undefined);
  assert.equal(next.worldIntro, undefined);
  assert.equal(next.narratorPersona, undefined);
  assert.equal(next.terminology, '术语');
  assert.equal(lib.readScriptTone(next), '新基调');
});

test('consolidateScriptTone_把分栏旧稿并进scriptTone', () => {
  const next = lib.consolidateScriptTone({ gmIntro: 'A', worldIntro: 'B', narratorPersona: 'C' });
  assert.equal(next.scriptTone, 'A\n\nB\n\nC');
  assert.equal(next.gmIntro, undefined);
});

test('mergeScriptToneFragments_新基调与旧三框跨包合并也不丢字', () => {
  const next = lib.mergeScriptToneFragments(
    { scriptTone: '世界底座', terminology: '旧术语' },
    { gmIntro: '叠加GM', worldIntro: '叠加世界', narratorPersona: '叠加口吻', terminology: '新术语' },
  );
  assert.equal(next.scriptTone, '世界底座\n\n叠加GM\n\n叠加世界\n\n叠加口吻');
  assert.equal(next.gmIntro, undefined);
  assert.equal(next.worldIntro, undefined);
  assert.equal(next.narratorPersona, undefined);
  assert.equal(next.terminology, '新术语');
});

test('编辑器_剧本基调在基础作品信息_剧情页不再有三块', () => {
  assert.match(panel, /剧本基调/);
  assert.match(panel, /readScriptTone\(c\.prompt\)/);
  assert.match(panel, /applyScriptTone/);
  assert.match(panel, /consolidateScriptTone/);
  assert.doesNotMatch(panel, /title="世界观提示词"/);
  assert.doesNotMatch(panel, /ModPromptEditor/);
  assert.doesNotMatch(panel, /label: "GM 开场白"/);
  assert.doesNotMatch(panel, /叙事口吻 \/ 文风/);
});

test('运行时_header读剧本基调_fragment不再重复世界观口吻', () => {
  assert.match(registry, /readScriptTone\(getWorld\(\)\.content\.prompt\)/);
  assert.match(registry, /mergeScriptToneFragments\(content\.prompt/);
  assert.doesNotMatch(registry, /p\.worldIntro && `【世界观】/);
  assert.doesNotMatch(registry, /p\.narratorPersona && `【叙事口吻】/);
});
