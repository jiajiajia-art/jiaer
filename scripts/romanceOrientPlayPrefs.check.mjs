/**
 * 屏幕方向：建角「游玩偏好」选定 → 开局写入 theme.orient；
 * 不再弹首次方向窗、不展示锁定开关；局内设置可随时切换。
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

test('PlayPrefsPicker_建角可选手方向且无锁定开关', () => {
  const picker = read('components/PlayPrefsPicker.tsx');
  assert.match(picker, /showOrient/);
  assert.match(picker, /aria-label="屏幕方向"/);
  assert.match(picker, /v: "landscape"/);
  assert.match(picker, /v: "portrait"/);
  assert.doesNotMatch(picker, /orientLock|锁定方向|选好后锁定/);
});

test('CharacterCreate_开局偏好带orient并展示选择器', () => {
  const create = read('components/CharacterCreate.tsx');
  assert.match(create, /showOrient/);
  assert.match(create, /orient: "portrait"/);
  assert.match(create, /playPrefs: \{ \.\.\.prefs, orient: prefs\.orient \?\? "portrait" \}/);
});

test('startNew_应将playPrefs\.orient写入theme并清锁', () => {
  const ctx = read('store/GameContext.tsx');
  assert.match(ctx, /opts\.playPrefs\.orient === "landscape"/);
  assert.match(ctx, /setTheme\(\{ \.\.\.themeRef\.current, orient, orientLock: false \}\)/);
  assert.match(ctx, /orientLock: false/);
  // 禁止再按锁拦截方向切换
  assert.doesNotMatch(ctx, /prev\.orientLock && !!t\.orientLock/);
});

test('GameShell_无首次方向弹窗且设置无锁定开关', () => {
  const shell = read('components/GameShell.tsx');
  assert.doesNotMatch(shell, /选好后锁定方向/);
  assert.doesNotMatch(shell, /竖屏，还是横屏？/);
  assert.doesNotMatch(shell, /lockPick/);
  assert.doesNotMatch(shell, /orientChosen/);
  assert.doesNotMatch(shell, /已锁定|解锁后才能切换/);
  // 设置里仍可切换横竖屏
  assert.match(shell, /屏幕方向/);
  assert.match(shell, /id: "landscape"/);
  assert.match(shell, /id: "portrait"/);
  assert.match(shell, /随时可改/);
});
