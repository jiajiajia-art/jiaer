/**
 * ⑥美化：删掉试用预览条与面板皮肤/动画整块；音乐区保留。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('美化页_禁止试用条与面板皮肤动画编辑控件', () => {
  const panel = read('components/ModEditorPanel.tsx');
  const theme = read('components/ModThemeEditor.tsx');
  // 功能注释：只断言 UI 文案/组件挂载，避免注释里复述旧需求时误伤
  assert.doesNotMatch(theme, />想先看看效果？</);
  assert.doesNotMatch(theme, />立即试用</);
  assert.doesNotMatch(panel, /ModSkinEditor/);
  assert.doesNotMatch(panel, /panelAnim|componentAnim|skin\.css/);
  assert.doesNotMatch(panel, /\.nm-panel/);
  assert.doesNotMatch(panel, />底色</);
  assert.doesNotMatch(panel, />面板动画</);
  assert.doesNotMatch(panel, />组件动画</);
  assert.doesNotMatch(panel, />自定义 CSS</);
});

test('美化页_音乐区块仍在皮肤美化之后', () => {
  const panel = read('components/ModEditorPanel.tsx');
  const skinIdx = panel.indexOf('title="皮肤美化"');
  const musicIdx = panel.indexOf('title="音乐"');
  assert.ok(skinIdx > 0 && musicIdx > skinIdx, '音乐应保留且排在皮肤美化后面');
  assert.match(panel, /ModBgmEditor/);
  assert.match(panel, /上传 · 链接 · 本机库 · 作品引用 · 平台曲库/);
});
