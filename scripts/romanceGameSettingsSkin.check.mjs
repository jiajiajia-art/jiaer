/**
 * 游戏设置三处：玩家美化只留皮肤；小说模式改名剧情模式；竖屏默认见 orient 单测。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const shell = readFileSync(join(romance, 'components/GameShell.tsx'), 'utf8');
const picker = readFileSync(join(romance, 'components/PlayPrefsPicker.tsx'), 'utf8');
const ai = readFileSync(join(romance, 'lib/ai.ts'), 'utf8');

test('游戏设置_玩家美化只留皮肤风格选择', () => {
  // 功能注释：玩家 general 设置不得再跳进主题包/对话框等完整美化
  assert.match(shell, /PlayerSkinPicker/);
  assert.match(shell, /title="美化"[^>]*desc="选择界面皮肤风格"/);
  assert.doesNotMatch(shell, /主题包 · 全局风格 · 对话框/);
  assert.doesNotMatch(shell, /onBeauty && \(/);
});

test('游玩偏好_小说模式改名剧情模式_说明不变', () => {
  assert.match(picker, /l: "剧情模式"/);
  assert.match(picker, /d: "长篇连续叙事 · 少系统提示"/);
  assert.doesNotMatch(picker, /l: "小说模式"/);
  assert.match(picker, /v: "novel"/); // 内部值不变
  assert.match(ai, /游玩模式 · 剧情模式/);
  assert.doesNotMatch(ai, /游玩模式 · 小说模式/);
});
