/**
 * 剧情模式可读性：叙事底透明度可调、正文黑字跟字体；初遇改为一行结识。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('theme_storyBgAlpha_与_App_注入_CSS变量', () => {
  const store = read('lib/store.ts');
  assert.match(store, /storyBgAlpha\?: number/);
  const app = read('App.tsx');
  assert.match(app, /--story-panel-a/);
  assert.match(app, /storyBgAlpha \?\? 88/);
  assert.match(app, /--story-font-size/);
  assert.match(app, /dialogDiy\?\.fontSize/);
  const css = read('index.css');
  assert.match(css, /\.story-narration-panel/);
  assert.match(css, /\.novel-read-card/);
  assert.match(css, /--story-panel-a/);
  assert.match(css, /--story-font-size/);
  assert.match(css, /\.story-prose[\s\S]*?font-style:\s*normal/);
  // 功能注释：3.2 叙事字色走 --story-ink（浅色 #1a1a1a，暗色浅字）
  assert.match(css, /\.story-action[\s\S]*?var\(--story-ink\)/);
  assert.match(css, /--story-ink: #1a1a1a/);
});

test('dialogDiy_字号覆盖小说内容卡与叠图旁白', () => {
  const free = read('lib/freeStyle.ts');
  assert.match(free, /--story-font-size/);
  assert.match(free, /novel-read-card \.story-prose/);
  assert.match(free, /story-narration-panel/);
  assert.match(free, /data-slot="scene-prose"/);
});

test('HomeTab_地点描写不写死字号_跟story-prose', () => {
  const home = read('components/HomeTab.tsx');
  // 功能注释：3.12 地点说明与旁白同规格，无首行缩进
  assert.match(home, /story-prose whitespace-pre-line leading-\[1\.8\]/);
  assert.doesNotMatch(home, /text-indent:2em/);
  assert.doesNotMatch(home, /story-prose whitespace-pre-line text-\[13\.5px\]/);
});

test('StoryTab_HomeTab_旁白用浅色底类_不用白字黑底', () => {
  const story = read('components/StoryTab.tsx');
  assert.match(story, /story-narration-panel/);
  assert.doesNotMatch(story, /bg-black\/50[\s\S]*text-white/);
  const home = read('components/HomeTab.tsx');
  assert.match(home, /story-narration-panel/);
  assert.doesNotMatch(home, /bg-paper\/92/);
  assert.match(home, /novel-read-card/);
});

test('GameShell_设置页有叙事底透明度滑杆', () => {
  const shell = read('components/GameShell.tsx');
  assert.match(shell, /叙事底透明度/);
  assert.match(shell, /storyBgAlpha/);
  assert.match(shell, /min=\{40\}/);
  assert.match(shell, /max=\{100\}/);
});

test('NewcomerCards_一行名字身份加结识_点行弹详情', () => {
  const src = read('components/NewcomerCards.tsx');
  assert.match(src, /结识/);
  assert.match(src, /meetNewcomer/);
  assert.match(src, /Modal/);
  assert.match(src, /初 遇/);
  assert.doesNotMatch(src, /暂不结识/);
  assert.doesNotMatch(src, /ui-card animate-pop flex flex-col/);
  assert.match(src, /stopPropagation/);
});

test('GameContext_meetNewcomer_幕后结识剧情', () => {
  const ctx = read('store/GameContext.tsx');
  assert.match(ctx, /const meetNewcomer = useCallback/);
  assert.match(ctx, /meetPerson\(g0, personId\)/);
  assert.match(ctx, /【结识 ·/);
  assert.match(ctx, /memory 摘要/);
  assert.match(ctx, /void runTurn\(\s*met,/);
  assert.match(ctx, /true,\s*\)/);
  const gameCtx = read('store/gameCtx.ts');
  assert.match(gameCtx, /meetNewcomer:/);
});
