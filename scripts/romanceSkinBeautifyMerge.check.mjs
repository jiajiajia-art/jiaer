/**
 * 「皮肤美化」只保留主题皮肤选择 + 自定义；去掉立即试用条与面板皮肤/动画 DIY。
 * 存档 theme / ext.skin 字段仍可被运行时读取，不在此页编辑。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const themeEditor = readFileSync(join(romance, 'components/ModThemeEditor.tsx'), 'utf8');
const ext = readFileSync(join(romance, 'components/ModExtEditor.tsx'), 'utf8');
const wizard = readFileSync(join(romance, 'lib/worldGenWizard.ts'), 'utf8');

test('编辑器皮肤美化_无试用条无面板皮肤动画块_音乐仍在', () => {
  assert.match(panel, /title="皮肤美化"/);
  assert.match(panel, /ModThemeEditor/);
  assert.match(panel, /g="look" title="音乐"/);
  assert.doesNotMatch(panel, /ModSkinEditor/);
  assert.doesNotMatch(panel, /<summary[^>]*>高级<\/summary>/);
  assert.doesNotMatch(panel, /title="主题外观"/);
  assert.doesNotMatch(panel, /title="皮肤与动画"/);
  assert.doesNotMatch(panel, /title="面板皮肤与动画"/);
  assert.doesNotMatch(themeEditor, />想先看看效果？</);
  assert.doesNotMatch(themeEditor, />立即试用</);
  assert.doesNotMatch(themeEditor, /resolveSkinTheme/);
  assert.doesNotMatch(themeEditor, /setTheme/);
  assert.match(themeEditor, /<Row title="皮肤">/);
  assert.match(themeEditor, /<summary[^>]*>自定义<\/summary>/);
});

test('功能扩展不再嵌皮肤与动画DIY', () => {
  assert.doesNotMatch(ext, /ModSkinEditor/);
  assert.doesNotMatch(ext, /皮肤与动画 DIY/);
});

test('向导清单_皮肤美化不进AI勾选_去掉extSkin独立项', () => {
  // 功能注释：皮肤美化改用引擎默认，不再出现在「本次需要 AI 生成的模组」
  assert.doesNotMatch(wizard, /id: "theme"/);
  assert.doesNotMatch(wizard, /name: "皮肤美化"/);
  assert.match(wizard, /WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS/);
  assert.doesNotMatch(wizard, /name: "主题外观"/);
  assert.doesNotMatch(wizard, /id: "extSkin"/);
  assert.doesNotMatch(wizard, /name: "皮肤与动画"/);
});

test('皮肤预设_补齐配套主题且允许自定义覆盖', async () => {
  const { resolveSkinTheme } = await import(pathToFileURL(join(romance, 'lib/skins.ts')).href);
  assert.deepEqual(resolveSkinTheme({ skin: 'dream' }), {
    skin: 'dream',
    accent: 'fuchsia',
    font: 'elegant',
    mode: 'auto',
  });
  assert.deepEqual(resolveSkinTheme({ skin: 'paper', font: 'hand', mode: 'dark' }), {
    skin: 'paper',
    accent: 'gold',
    font: 'hand',
    mode: 'dark',
  });
});

test('不指定皮肤_不注入任何外观设置', async () => {
  const { resolveSkinTheme } = await import(pathToFileURL(join(romance, 'lib/skins.ts')).href);
  assert.deepEqual(resolveSkinTheme({}), {});
  assert.deepEqual(resolveSkinTheme({ accent: 'jade' }), { accent: 'jade' });
});
