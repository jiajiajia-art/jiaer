/**
 * 菜单：财务入口改为「玩法 Mod」，按玩法显隐；暗色模式并入游戏设置。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const shell = readFileSync(join(romance, 'components/GameShell.tsx'), 'utf8');
const glyphs = readFileSync(join(romance, 'lib/iconGlyphs.tsx'), 'utf8');
const finance = readFileSync(join(romance, 'components/Finance.tsx'), 'utf8');

test('菜单_财务改名为玩法Mod且按玩法显隐', () => {
  assert.match(shell, /label="玩法 Mod"/);
  assert.match(shell, /shouldShowPlayModMenuEntry\(feature\("career"\),\s*worldHas\("bills"\)\)/);
  assert.doesNotMatch(shell, /label="财务 ·/);
  assert.doesNotMatch(shell, /财务 · 支票账单/);
});

test('菜单_SETTINGS不再单独列暗色模式', () => {
  // 功能注释：暗色模式须在游戏设置面板内，禁止 SETTINGS 列表再挂 MenuRow
  const settingsBlock = shell.slice(shell.indexOf('SETTINGS'), shell.indexOf('SETTINGS') + 1200);
  assert.doesNotMatch(settingsBlock, /label="暗色模式"/);
  assert.match(shell, /hint="暗色模式 · 界面皮肤 · 背景音乐 · 字体风格 · 屏幕方向"/);
});

test('游戏设置_含暗色模式开关', () => {
  // 功能注释：3.7 暗色改为单行一键开关（不再包 SettingBranch 折叠）
  assert.doesNotMatch(shell, /<SettingBranch[^>]*title="暗色模式"/);
  assert.match(shell, /data-dark-toggle="1"/);
  assert.match(shell, /onClick=\{toggleDarkMode\}/);
  assert.match(shell, />暗色模式</);
});

test('图标库_菜单项同步玩法Mod且去掉暗色模式', () => {
  assert.match(glyphs, /"玩法 Mod"/);
  assert.doesNotMatch(glyphs, /财务 · 支票账单/);
  assert.doesNotMatch(glyphs, /"暗色模式"/);
});

test('财务弹窗标题跟菜单玩法Mod对齐', () => {
  assert.match(finance, /玩法 Mod · 支票与账单/);
});

test('shouldShowPlayModMenuEntry_主路径与双关', async () => {
  const mod = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  assert.equal(mod.shouldShowPlayModMenuEntry(true, false), true);
  assert.equal(mod.shouldShowPlayModMenuEntry(false, true), true);
  assert.equal(mod.shouldShowPlayModMenuEntry(true, true), true);
  assert.equal(mod.shouldShowPlayModMenuEntry(false, false), false);
});
