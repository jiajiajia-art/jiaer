/**
 * 设置「最大回复」：钳制、校验、静默开局默认更长
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildSilentDefaultGameStartConfig,
  clampMaxResponseChars,
  GAME_START_LIMITS,
  validateGameStartConfig,
} from '../src/lib/galgame/gameStartConfig.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('clampMaxResponseChars_非法与边界', () => {
  assert.equal(clampMaxResponseChars(undefined), null);
  assert.equal(clampMaxResponseChars(NaN), null);
  assert.equal(clampMaxResponseChars(100), GAME_START_LIMITS.maxResponseChars.min);
  assert.equal(clampMaxResponseChars(5000), GAME_START_LIMITS.maxResponseChars.max);
  assert.equal(clampMaxResponseChars(800), 800);
});

test('validateGameStartConfig_写入maxResponseChars', () => {
  const ok = validateGameStartConfig({
    player: { name: '白茶', gender: 'female' },
    openingRouteId: 'route-a',
    maxResponseChars: 1500,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.data.maxResponseChars, 1500);

  const clamped = validateGameStartConfig({
    player: { name: '白茶', gender: 'female' },
    openingRouteId: 'route-a',
    maxResponseChars: 50,
  });
  assert.equal(clamped.ok, true);
  if (!clamped.ok) return;
  assert.equal(clamped.data.maxResponseChars, GAME_START_LIMITS.maxResponseChars.min);
});

test('buildSilentDefaultGameStartConfig_默认最大回复为800', () => {
  const built = buildSilentDefaultGameStartConfig({
    playerName: '白茶',
    gender: 'female',
    routes: [{ id: 'a', title: '线A' }],
  });
  assert.equal(built.ok, true);
  assert.equal(built.data?.maxResponseChars, GAME_START_LIMITS.maxResponseChars.default);
});

test('SettingsModal_含最大回复滑条契约', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/SettingsModal.tsx'), 'utf8');
  assert.match(src, /maxResponseChars/);
  assert.match(src, /createGame\.maxResponse/);
  assert.match(src, /onMaxResponseCharsChange/);
  assert.match(src, /meterRow/);
  assert.match(src, /meterValue/);
});

test('SettingsModal_保存仅关弹窗不退出游戏', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/SettingsModal.tsx'), 'utf8');
  assert.match(src, /onConfirmSettings/);
  assert.match(src, /handleConfirmAndClose/);
  assert.match(src, /createGame\.settingsDone/);
  assert.match(src, /exitGameLink/);
  assert.match(src, /className=\{styles\.doneButton\}/);
  assert.doesNotMatch(src, /createGame\.saveAndExit/);
  const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');
  assert.match(zh, /"settingsDone":\s*"保存"/);
  const galgame = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(galgame, /onConfirmSettings=\{/);
  assert.match(galgame, /flushMaxResponseCharsPersist/);
});
