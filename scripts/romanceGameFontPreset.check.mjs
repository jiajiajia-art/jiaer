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

test('ensureGameFontsLoaded_注入国内镜像 stylesheet', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/gameFonts.ts')).href);
  assert.match(mod.GAME_FONTS_STYLESHEET, /fonts\.loli\.net/);
  assert.doesNotMatch(mod.GAME_FONTS_STYLESHEET, /fonts\.googleapis\.com/);
  assert.match(mod.GAME_FONTS_STYLESHEET, /ZCOOL\+KuaiLe/);
  assert.match(mod.GAME_FONTS_STYLESHEET, /Ma\+Shan\+Zheng/);
  assert.match(mod.GAME_FONTS_STYLESHEET, /Pixelify\+Sans/);
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
  assert.match(css, /html\[data-romance\]\.font-song[\s\S]*?--font-sans:\s*'Noto Serif SC'/);
  assert.match(css, /\.dlg-bubble[\s\S]*?font-family:\s*var\(--font-serif\)/);
});

test('FreeFont_删除粘贴字体直链输入', () => {
  const panel = read('Romance/src/components/FreeStylePanel.tsx');
  const start = panel.indexOf('export function FreeFont');
  assert.ok(start >= 0);
  const end = panel.indexOf('export function AssetLibrary', start);
  const block = panel.slice(start, end > start ? end : undefined);
  assert.match(block, /上传字体文件/);
  assert.doesNotMatch(block, /粘贴字体直链/);
  assert.doesNotMatch(block, /或粘贴字体/);
  assert.doesNotMatch(block, /onKeyDown[\s\S]*https\?:\/\//);
});
