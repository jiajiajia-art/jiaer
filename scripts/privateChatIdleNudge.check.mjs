/**
 * 私聊静默计时闸门单测（前端）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePrivateChatIdleMs,
  shouldArmPrivateChatIdleNudge,
} from '../src/lib/galgame/privateChatIdleNudge.ts';

test('resolvePrivateChatIdleMs_默认30秒', () => {
  assert.equal(resolvePrivateChatIdleMs(null), 30_000);
  assert.equal(resolvePrivateChatIdleMs({ idleProactiveMs: 45000 }), 45000);
});

test('shouldArmPrivateChatIdleNudge_实验组且末条为助手', () => {
  assert.equal(
    shouldArmPrivateChatIdleNudge({
      ab: { idleProactive: true, idleProactiveMs: 30000 },
      busy: false,
      waitingNarrative: false,
      loading: false,
      draft: '',
      messages: [{ role: 'assistant' }],
    }),
    true,
  );
  assert.equal(
    shouldArmPrivateChatIdleNudge({
      ab: { idleProactive: false, idleProactiveMs: 30000 },
      busy: false,
      waitingNarrative: false,
      loading: false,
      draft: '',
      messages: [{ role: 'assistant' }],
    }),
    false,
  );
  assert.equal(
    shouldArmPrivateChatIdleNudge({
      ab: { idleProactive: true },
      busy: false,
      waitingNarrative: false,
      loading: false,
      draft: '正在打字',
      messages: [{ role: 'assistant' }],
    }),
    false,
  );
  // 已连续 2 条助手（主角不回）→ 不再计时
  assert.equal(
    shouldArmPrivateChatIdleNudge({
      ab: { idleProactive: true },
      busy: false,
      waitingNarrative: false,
      loading: false,
      draft: '',
      messages: [{ role: 'assistant' }, { role: 'assistant' }],
    }),
    false,
  );
});
