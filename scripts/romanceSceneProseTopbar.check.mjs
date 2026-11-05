/**
 * 小说界面：顶栏状态行上移并可点开任务主线；叠图叙事段加半透明底，对白气泡保持原样。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('TopbarView_状态行上移且点开任务主线', () => {
  const tb = read('components/TopbarView.tsx');
  assert.match(tb, /star:quest-open/);
  assert.match(tb, /打开任务主线/);
  assert.match(tb, /状态行上移/);
  assert.match(tb, /className="mt-1"/);
  assert.doesNotMatch(tb, /\{bar && <div className="mt-2\.5">\{bar\}<\/div>\}/);
  // 状态行不再打开人物档案
  const barBlock = tb.slice(tb.indexOf('打开任务主线'), tb.indexOf('const label ='));
  assert.doesNotMatch(barBlock, /onProfile\?\.\(\)/);
});

test('GameShell_quest事件打开剧情志弹窗', () => {
  const shell = read('components/GameShell.tsx');
  assert.match(shell, /star:quest-open/);
  assert.match(shell, /dest === "quest"[\s\S]{0,80}setQuestOpen\(true\)/);
});

test('StoryTab_叠图旁白有半透明底_对白气泡不改', () => {
  const story = read('components/StoryTab.tsx');
  assert.match(story, /overlay\?: boolean/);
  // 功能注释：叠图旁白改用可调透明度的 story-narration-panel（浅底黑字），不再写死黑底白字
  assert.match(story, /story-narration-panel/);
  assert.doesNotMatch(story, /bg-black\/50/);
  // 对白气泡类名仍在
  assert.match(story, /dlg-bubble-me/);
  assert.match(story, /dlg-bubble relative/);
  // 旁白 overlay 分支与纸面旁白分支并存
  assert.match(story, /if \(s\.kind === "narration"\)\s*return overlay/);
});

test('HomeTab_场景正文overlay随小说模式切换', () => {
  const home = read('components/HomeTab.tsx');
  assert.match(home, /Segments[\s\S]{0,160}overlay=\{!isNovel\}/);
  assert.match(home, /LiveNarration[\s\S]{0,60}overlay=\{!isNovel\}/);
  assert.match(home, /descText[\s\S]{0,280}story-narration-panel/);
  assert.doesNotMatch(home, /descText[\s\S]{0,280}bg-black\/50/);
});
