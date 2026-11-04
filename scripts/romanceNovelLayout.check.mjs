/**
 * 小说模式排版：顶栏三行（名牌 / 状态 / 可展开主线）+ 场景上内容卡（地点天气/外出/正文/输入）；
 * 颜色与圆角只读皮肤变量；底栏仍走创作者配置。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('homeMainQuest_附带进度字段', async () => {
  const lib = await import(pathToFileURL(join(romance, 'lib/homeMainQuest.ts')).href);
  const lines = [{
    id: 'main1',
    name: '寻找失踪的同学',
    nodes: [
      { id: 'n1', name: '打听线索', conds: [] },
      { id: 'n2', name: '找到同学', conds: [] },
    ],
  }];
  const q0 = lib.homeMainQuest({ flags: {}, clockMin: 480, day: 0 }, lines);
  assert.equal(q0?.stepName, '打听线索');
  assert.equal(q0?.done, 0);
  assert.equal(q0?.total, 2);
  assert.equal(q0?.progress, 0);

  const q1 = lib.homeMainQuest({ flags: { 'quest:n1': 1 }, clockMin: 480, day: 0 }, lines);
  assert.equal(q1?.stepName, '找到同学');
  assert.equal(q1?.done, 1);
  assert.equal(q1?.total, 2);
  assert.equal(q1?.progress, 0.5);

  const prog = lib.questProgressOf(lines[0], { flags: { 'quest:n1': 1, 'quest:n2': 1 }, clockMin: 0, day: 0 });
  assert.equal(prog.done, 2);
  assert.equal(prog.progress, 1);
});

test('TopbarView_小说模式固定三行且主线可展开', () => {
  const tb = read('components/TopbarView.tsx');
  assert.match(tb, /novelLayout\?: boolean/);
  assert.match(tb, /data-layout="novel"/);
  assert.match(tb, /novel-quest/);
  assert.match(tb, /setQuestOpen/);
  assert.match(tb, /查看档案/);
  assert.match(tb, /行动/);
  assert.match(tb, /questProgress/);
  assert.match(tb, /rounded-\[var\(--radius-ui\)\]/);
  assert.match(tb, /bg-jade/);
  assert.match(tb, /text-ink/);
  // 小说排版不硬编码 mock 粉色
  assert.doesNotMatch(tb.slice(tb.indexOf('novelLayout && !compact'), tb.indexOf('} else {')), /#f[0-9a-f]{5}|pink|rose-|#e8d/i);
});

test('GameShell_小说模式传novelLayout与进度', () => {
  const shell = read('components/GameShell.tsx');
  assert.match(shell, /novelLayout=\{novelLayout\}/);
  assert.match(shell, /playPrefsOf\(game\)\.mode === "novel"/);
  assert.match(shell, /questProgress:\s*mainQuest\.progress/);
  assert.match(shell, /questDone:\s*mainQuest\.done/);
});

test('HomeTab_小说内容卡地点天气外出与输入', () => {
  const home = read('components/HomeTab.tsx');
  assert.match(home, /novelCard=\{isNovel\}/);
  assert.match(home, /data-novel-card="1"/);
  assert.match(home, /novel-read-card/);
  assert.match(home, /footer=\{isNovel \? actionInput/);
  assert.match(home, /rounded-\[var\(--radius-ui-lg\)\]/);
  assert.match(home, /bg-paper\/92/);
  assert.match(home, /overlay=\{!isNovel\}/);
  assert.match(home, /!isNovel && !isAuthorPreview\(\)/);
  // 内容卡顶栏有地点 + 外出
  const hero = home.match(/function LocationHero\([\s\S]*?\n\}\n\n\/\* 人物档案卡/)?.[0] ?? '';
  assert.match(hero, /外出/);
  assert.match(hero, /weather/);
  assert.match(hero, /IconPin/);
});
