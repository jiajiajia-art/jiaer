/**
 * 作者预览：必须吃当前表单草稿，而非库内已保存世界；
 * commitSelection / activateWorld 在预览期不得把生效世界打回 selection 旧值。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('openPreview_传clean后的当前表单_不读已保存库', () => {
  const panel = read('components/ModEditorPanel.tsx');
  const openAt = panel.indexOf('const openPreview = ');
  assert.ok(openAt >= 0);
  const open = panel.slice(openAt, panel.indexOf('useEffect(() => { if (!savedTip)', openAt));
  assert.match(open, /const out = clean\(\)/);
  assert.match(open, /requestAuthorPreview\(out/);
  assert.doesNotMatch(open, /importModJson\(|modById\(|getWorld\(/);
  // 功能注释：注释须写明「保存与否都走同一路径」
  assert.match(open, /保存与否都走同一路径|当前表单/);
});

test('registry_预览同步selection且保护applied', () => {
  const reg = read('mods/registry.ts');
  const begin = reg.slice(
    reg.indexOf('export function beginAuthorPreviewMod'),
    reg.indexOf('export function endAuthorPreviewMod'),
  );
  const end = reg.slice(
    reg.indexOf('export function endAuthorPreviewMod'),
    reg.indexOf('export function missingDeps'),
  );
  const commit = reg.slice(
    reg.indexOf('export function commitSelection'),
    reg.indexOf('export function saveAddons'),
  );
  const activate = reg.slice(
    reg.indexOf('export function activateWorld'),
    reg.indexOf('export const selectionPending'),
  );
  assert.match(begin, /selection\s*=\s*\{\s*world:\s*mod\.id/);
  assert.match(begin, /authorPreviewRestore\s*=\s*\{[\s\S]*selection:/);
  assert.doesNotMatch(begin, /write\(K_SEL|write\(K_APPLIED/);
  assert.match(end, /selection\s*=\s*authorPreviewRestore\.selection/);
  assert.match(end, /write\(K_SEL/);
  assert.match(commit, /if \(authorPreviewMod\)/);
  assert.match(activate, /if \(authorPreviewMod\?\.kind === "world"\)/);
});

test('GameContext_每次预览须清空旧测试档', () => {
  const ctx = read('store/GameContext.tsx');
  const onStart = ctx.slice(ctx.indexOf('const onStart = '), ctx.indexOf('const onEnd = '));
  assert.match(onStart, /beginAuthorPreviewMod\(detail\.mod\)/);
  assert.match(onStart, /clearAuthorPreviewSave\(AUTHOR_PREVIEW_GAME_ID\)/);
  assert.match(onStart, /purgeSaveData\(AUTHOR_PREVIEW_GAME_ID\)/);
  // 清档须在 switchSave 之前，避免先载入旧档
  assert.ok(
    onStart.indexOf('clearAuthorPreviewSave') < onStart.indexOf('switchSave(AUTHOR_PREVIEW_GAME_ID'),
    '清档应在 switchSave 之前',
  );
});

test('ModEditorPanel_返回设定须确认未保存修改', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /const backToWizard = async/);
  assert.match(panel, /有未保存的修改/);
  assert.match(panel, /void backToWizard\(\)/);
  assert.doesNotMatch(panel, /onClick=\{onBackToWizard\}/);
});
