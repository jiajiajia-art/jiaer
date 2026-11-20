/**
 * 游戏字体预设：点选后正文/对话/界面跟套；自定义区不再提供粘贴直链。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('withFontPreset_点选预设时清掉自定义字体文件', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/gameFonts.ts')).href);
  const base = {
    mode: 'auto',
    accent: 'plum',
    font: 'song',
    free: { on: true, font: { name: '我的字', url: 'data:font/woff2;base64,xx' }, colors: { jade: '#123' } },
  };
  const next = mod.withFontPreset(base, 'hei');
  assert.equal(next.font, 'hei');
  assert.equal(next.free?.font, undefined);
  // 功能注释：其它自由美化项须保留
  assert.equal(next.free?.colors?.jade, '#123');
});

test('withFontPreset_无自定义字体时只改 font id', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/gameFonts.ts')).href);
  const next = mod.withFontPreset({ mode: 'light', accent: 'jade', font: 'song' }, 'round');
  assert.equal(next.font, 'round');
  assert.equal(next.free, undefined);
});

test('ensureGameFontsLoaded_注入本地字体 stylesheet', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/gameFonts.ts')).href);
  assert.equal(mod.resolveGameFontsStylesheetHref('/funloom/'), '/funloom/fonts/game/fonts.css');
  assert.equal(mod.resolveGameFontsStylesheetHref('/'), '/fonts/game/fonts.css');
  assert.match(mod.GAME_FONTS_STYLESHEET, /fonts\/game\/fonts\.css$/);
  assert.doesNotMatch(mod.GAME_FONTS_STYLESHEET, /https?:\/\//);
  const src = read('Romance/src/lib/gameFonts.ts');
  assert.match(src, /resolveGameFontsStylesheetHref/);
  // 功能注释：只拦真实 URL，注释里写域名不算
  assert.doesNotMatch(src, /https?:\/\/fonts\./);
});

test('App_应用主题时加载预设字体并挂 font class', () => {
  const app = read('Romance/src/App.tsx');
  assert.match(app, /ensureGameFontsLoaded/);
  assert.match(app, /font-\$\{look\.font \?\? "song"\}/);
});

test('GameShell_点选预设走 withFontPreset', () => {
  const shell = read('Romance/src/components/GameShell.tsx');
  assert.match(shell, /withFontPreset\(theme, ft\.id\)/);
  assert.doesNotMatch(shell, /setTheme\(\{ \.\.\.theme, font: ft\.id/);
});

test('CSS_每套预设同时改 serif 与 sans_对话跟套', () => {
  const css = read('Romance/src/index.css');
  // 功能注释：毛笔/草书也曾只改 serif，界面仍走系统黑体——须两侧同套
  for (const id of ['song', 'hei', 'round', 'elegant', 'brush', 'hand', 'cursive', 'pixel']) {
    const re = new RegExp(
      String.raw`html\[data-romance\]\.font-${id}\s*\{[^}]*--font-serif:[^;]+;[^}]*--font-sans:[^;]+;`,
    );
    assert.match(css, re, `font-${id} 须同时声明 --font-serif 与 --font-sans`);
  }
  assert.match(css, /html\[data-romance\]\.font-brush[\s\S]*?--font-sans:\s*'Ma Shan Zheng'/);
  assert.match(css, /html\[data-romance\]\.font-cursive[\s\S]*?--font-sans:\s*'Zhi Mang Xing'/);
  assert.match(css, /html\[data-romance\]\.font-song[\s\S]*?--font-sans:\s*'Source Han Serif SC'/);
  assert.match(css, /\.dlg-bubble[\s\S]*?font-family:\s*var\(--font-serif\)/);
});

test('剧情字体设置只提供预设，小说正文使用剧情字体', () => {
  const panel = read('Romance/src/components/FreeStylePanel.tsx');
  const shell = read('Romance/src/components/GameShell.tsx');
  const css = read('Romance/src/index.css');
  assert.doesNotMatch(panel, /上传字体文件/);
  assert.doesNotMatch(shell, /自定义字体文件/);
  assert.doesNotMatch(css, /\.novel-read-card \.story-prose[^{}]*\{[^{}]*font-family:\s*var\(--font-ui\)/);
});
