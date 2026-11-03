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
  assert.match(editor, /发现本机未保存的草稿/);
  assert.match(editor, /ui-btn ui-btn-primary/);
  assert.doesNotMatch(editor, /继续填写草稿[\s\S]{0,80}bg-jade/);
  assert.match(kit, /ui-btn-primary/);
  assert.doesNotMatch(kit, /close\(true\)[\s\S]{0,200}bg-jade/);
});

test('romance-platform弹窗色板收成--fl与--sheet变量', () => {
  const css = read('index.css');
  assert.match(css, /--fl-wine:\s*#A8283C/);
  assert.match(css, /--sheet-solid:\s*var\(--fl-sheet\)/);
  assert.match(css, /\.romance-platform \.ui-btn-primary/);
  assert.match(css, /\.romance-platform \.ui-sheet select/);
  // 编辑器内主按钮不再写死 #A8283C
  assert.doesNotMatch(css, /\.world-gen-editor button\[class\*="bg-jade"\][^{]*\{[^}]*#A8283C/);
  // 平台壳打开时 toast 跟暗红，禁止成功条仍写死绿
  assert.match(css, /html:has\(\[data-platform-ui="1"\]\) \.funloom-toast/);
  assert.match(css, /html:has\(\[data-platform-ui="1"\]\) \.funloom-toast-success/);
});
