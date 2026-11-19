/**
 * 平台创作壳弹窗须继承暗红 token：挂到 data-platform-ui，禁止白底绿主按钮。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('Modal与裁切弹窗挂到romancePortalRoot优先平台壳', () => {
  const portal = read('lib/romancePortalRoot.ts');
  const ui = read('components/ui.tsx');
  const crop = read('components/LocalAvatarCropFlow.tsx');
  assert.match(portal, /data-platform-ui/);
  assert.match(portal, /\.romance-platform/);
  assert.match(portal, /\.romance-host/);
  // 功能注释：跳过 hidden / aria-hidden 宿主，避免作者预览把建角弹窗挂进不可见向导壳
  assert.match(portal, /isUsablePortalHost|classList\.contains\("hidden"\)/);
  assert.match(portal, /aria-hidden/);
  assert.match(portal, /querySelectorAll/);
  assert.match(ui, /romancePortalRoot/);
  assert.doesNotMatch(ui, /querySelector\("\.romance-host"\)/);
  assert.match(crop, /romancePortalRoot/);
  assert.doesNotMatch(crop, /document\.body/);
});

test('草稿与确认弹窗主按钮走ui-btn-primary不用硬编码bg-jade白字', () => {
  const editor = read('components/ModEditorPanel.tsx');
  const kit = read('components/EditorKit.tsx');
  // 草稿冲突主按钮在 DraftConflictChoice，标题为「要接着哪份写？」
  const choice = read('components/DraftConflictChoice.tsx');
  assert.match(editor, /title="要接着哪份写？"/);
  assert.match(editor, /DraftConflictChoice/);
  assert.match(choice, /用这份继续/);
  assert.match(kit, /ui-btn ui-btn-sm ui-btn-primary/);
  assert.match(kit, /ui-btn-primary/);
  assert.doesNotMatch(kit, /close\(true\)[\s\S]{0,200}bg-jade/);
});

test('romance-platform弹窗色板收成--fl与--sheet变量', () => {
  const css = read('index.css');
  // 平台酒红跟主站 --color-primary，暗色壳回退 #a8283c
  assert.match(css, /--fl-wine:\s*var\(--color-primary,\s*#d42a2a\)/);
  assert.match(css, /--fl-wine:\s*#a8283c/);
  assert.match(css, /--sheet-solid:\s*var\(--fl-sheet\)/);
  assert.match(css, /\.romance-platform \.ui-btn-primary/);
  assert.match(css, /\.romance-platform \.ui-sheet select/);
  // 编辑器内主按钮不再写死 #A8283C
  assert.doesNotMatch(css, /\.world-gen-editor button\[class\*="bg-jade"\][^{]*\{[^}]*#A8283C/);
  // 平台壳打开时 toast 跟暗红，禁止成功条仍写死绿
  assert.match(css, /html:has\(\[data-platform-ui="1"\]\) \.funloom-toast/);
  assert.match(css, /html:has\(\[data-platform-ui="1"\]\) \.funloom-toast-success/);
});
