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

test('音乐并入基本信息_仍可上传贴链接选曲库', () => {
  const panel = read('components/ModEditorPanel.tsx');
  // 功能注释：音乐已并入①基础「基本信息」底部
  assert.match(panel, /音乐并入基本信息底部/);
  assert.match(panel, /ModBgmEditor/);
  // 音乐区 hint 现为可上传、贴链接，或从素材库 / 平台曲库选用
  assert.match(panel, /可上传、贴链接，或从素材库 \/ 平台曲库选用/);
});
