/**
 * 作者预览顶栏：只显示当前主线步骤，隐藏周数/日期/地点/金钱/倒计时。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('TopbarView_支持questOnly只渲主线步骤', () => {
  const tb = read('Romance/src/components/TopbarView.tsx');
  assert.match(tb, /questOnly/);
  assert.match(tb, /data-tour="topbar-quest"/);
  assert.match(tb, /data\.questStep/);
  assert.match(tb, /作者预览状态栏只留当前主线/);
});

test('GameShell_作者预览传入questOnly与questStep', () => {
  const shell = read('Romance/src/components/GameShell.tsx');
  assert.match(shell, /isAuthorPreview/);
  assert.match(shell, /homeMainQuest/);
  assert.match(shell, /questOnly=\{authorPreviewing\}/);
  assert.match(shell, /questStep/);
  assert.doesNotMatch(shell, /questOnly=\{true\}/);
});

test('topbarDiy_TopbarData含questStep字段', () => {
  const diy = read('Romance/src/lib/topbarDiy.ts');
  assert.match(diy, /questStep\?:/);
});
