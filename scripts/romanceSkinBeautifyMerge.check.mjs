/**
 * 「主题外观」+「皮肤与动画」合成⑥美化「皮肤美化」；功能扩展不再嵌皮肤编辑。
 * 存档仍分 content.theme / ext.skin，不丢已配内容。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const ext = readFileSync(join(romance, 'components/ModExtEditor.tsx'), 'utf8');
const wizard = readFileSync(join(romance, 'lib/worldGenWizard.ts'), 'utf8');

test('编辑器只有皮肤美化一块_含主题与ext.skin上下两段', () => {
  assert.match(panel, /title="皮肤美化"/);
  assert.match(panel, /ModThemeEditor/);
  assert.match(panel, /ModSkinEditor/);
  assert.match(panel, /面板皮肤与动画/);
  assert.doesNotMatch(panel, /title="主题外观"/);
  assert.doesNotMatch(panel, /title="皮肤与动画"/);
  const look = panel.slice(panel.indexOf('title="皮肤美化"'), panel.indexOf('title="音乐"'));
  assert.ok(look.indexOf('ModThemeEditor') < look.indexOf('ModSkinEditor'), '主题在上、面板皮肤在下');
});

test('功能扩展不再嵌皮肤与动画DIY', () => {
  assert.doesNotMatch(ext, /ModSkinEditor/);
  assert.doesNotMatch(ext, /皮肤与动画 DIY/);
});

test('向导清单合并为皮肤美化_去掉extSkin独立项', () => {
  assert.match(wizard, /name: "皮肤美化"/);
  assert.doesNotMatch(wizard, /name: "主题外观"/);
  assert.doesNotMatch(wizard, /id: "extSkin"/);
  assert.doesNotMatch(wizard, /name: "皮肤与动画"/);
});
