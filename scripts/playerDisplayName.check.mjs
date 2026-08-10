/**
 * 玩家展示名 — 前端严格契约（纳入 npm test）
 * 与后端 checks/playerDisplayName.check.mjs 对齐。
 * 只直接测 playerDisplayName，避免经 gameStartConfig 触发 Node ESM 无扩展名解析问题。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPlaceholderPlayerName,
  resolvePlayerDisplayName,
  resolvePlayerDisplayNameOrFallback,
  PLAYER_DISPLAY_NAME_FALLBACK,
} from '../src/lib/galgame/playerDisplayName.ts';

test('isPlaceholderPlayerName_应识别玩家与旅人', () => {
  assert.equal(isPlaceholderPlayerName('玩家'), true);
  assert.equal(isPlaceholderPlayerName('旅人'), true);
  assert.equal(isPlaceholderPlayerName('晚娃'), false);
});

test('resolvePlayerDisplayName_文档主角优先于占位_模拟world点player路径', () => {
  // 错误路径 presetData.player 为空；正确路径 world.player 有名
  assert.equal(resolvePlayerDisplayName([undefined, '晚娃']), '晚娃');
  assert.equal(resolvePlayerDisplayName(['玩家', '晚娃']), '晚娃');
  assert.equal(resolvePlayerDisplayName(['旅人', '林晚娃']), '林晚娃');
  assert.equal(resolvePlayerDisplayName(['李寡妇', '晚娃']), '李寡妇');
});

test('resolvePlayerDisplayName_全占位时返回空避免写入session', () => {
  assert.equal(resolvePlayerDisplayName(['玩家', '旅人', '']), '');
  assert.equal(
    resolvePlayerDisplayNameOrFallback(['玩家']),
    PLAYER_DISPLAY_NAME_FALLBACK,
  );
});

test('编辑档案默认名契约_应用文档主角而非玩家或旅人', () => {
  const documentPlayerName = '晚娃';
  const profileNamePlaceholder = '旅人';
  const draftName = resolvePlayerDisplayNameOrFallback([
    profileNamePlaceholder,
    documentPlayerName,
  ]);
  assert.equal(draftName, '晚娃');
  assert.notEqual(draftName, '玩家');
  assert.notEqual(draftName, '旅人');
});
