/**
 * 屏幕方向：每局进游玩默认竖屏 9:16；建角不再选手方向；
 * 局内「游戏设置」可随时切横屏；读档进局同样复位竖屏。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('PlayPrefs_类型含orient字段', () => {
  const types = read('lib/types.ts');
  assert.match(types, /export type ScreenOrient = "portrait" \| "landscape"/);
  assert.match(types, /orient\?: ScreenOrient/);
});

test('defaultTheme_默认竖屏', () => {
  const store = read('lib/store.ts');
  assert.match(store, /orient:\s*"portrait"/);
});

test('PlayPrefsPicker_仍可选手方向但建角不展示', () => {
  const picker = read('components/PlayPrefsPicker.tsx');
  assert.match(picker, /showOrient/);
  assert.match(picker, /aria-label="屏幕方向"/);
  assert.match(picker, /v: "landscape"/);
  assert.match(picker, /v: "portrait"/);
  assert.doesNotMatch(picker, /orientLock|锁定方向|选好后锁定/);
});

test('CharacterCreate_建角不展示方向_开局偏好仍带竖屏', () => {
  const create = read('components/CharacterCreate.tsx');
  assert.doesNotMatch(create, /showOrient/);
  assert.match(create, /orient: "portrait"/);
  assert.match(create, /playPrefs: \{ \.\.\.prefs, orient: prefs\.orient \?\? "portrait" \}/);
});

test('startNew_强制竖屏写入theme与playPrefs', () => {
  const ctx = read('store/GameContext.tsx');
  assert.match(ctx, /orient: "portrait"/);
  assert.match(ctx, /setTheme\(\{ \.\.\.themeRef\.current, orient: "portrait", orientLock: false \}\)/);
  assert.match(ctx, /playPrefs = \{ \.\.\.opts\.playPrefs, orient: "portrait" \}/);
  // 禁止再按建角 landscape 直接开局
  assert.doesNotMatch(ctx, /opts\.playPrefs\.orient === "landscape"/);
  assert.doesNotMatch(ctx, /prev\.orientLock && !!t\.orientLock/);
});

test('loadState_读档进局复位竖屏', () => {
  const ctx = read('store/GameContext.tsx');
  assert.match(ctx, /playPrefs: \{ \.\.\.g0\.playPrefs, orient: "portrait"/);
  assert.match(ctx, /读档进局同样默认竖屏/);
});

test('GameShell_无首次方向弹窗且设置无锁定开关', () => {
  const shell = read('components/GameShell.tsx');
  assert.doesNotMatch(shell, /选好后锁定方向/);
  assert.doesNotMatch(shell, /竖屏，还是横屏？/);
  assert.doesNotMatch(shell, /lockPick/);
  assert.doesNotMatch(shell, /orientChosen/);
  assert.doesNotMatch(shell, /已锁定|解锁后才能切换/);
  assert.match(shell, /屏幕方向/);
  assert.match(shell, /id: "landscape"/);
  assert.match(shell, /id: "portrait"/);
  assert.match(shell, /每局默认竖屏/);
});
