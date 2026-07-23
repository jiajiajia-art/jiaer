/**
 * 选项点击门闩 + 选项上屏时机
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { canSubmitChoiceInteraction } from '../src/lib/galgame/choiceInteractionGate.ts';
import {
  GENERATION_BUSY_MAX_RETRIES,
  getGenerationBusyRetryDelayMs,
  isGenerationBusyError,
  shouldDeferChoiceUntilStreamReady,
} from '../src/lib/galgame/choiceStepDisplayGate.ts';

test('canSubmitChoiceInteraction_选项已展示且流式结束时应允许点击', () => {
  assert.equal(
    canSubmitChoiceInteraction({
      isWaitingForData: false,
      streamReady: true,
    }),
    true,
  );
});

test('canSubmitChoiceInteraction_等待流式数据时应禁止点击', () => {
  assert.equal(canSubmitChoiceInteraction({ isWaitingForData: true }), false);
});

test('canSubmitChoiceInteraction_压缩上下文时应禁止点击', () => {
  assert.equal(
    canSubmitChoiceInteraction({
      isWaitingForData: false,
      isCompressingContext: true,
      streamReady: true,
    }),
    false,
  );
});

test('canSubmitChoiceInteraction_流式未结束时应禁止点击', () => {
  assert.equal(
    canSubmitChoiceInteraction({
      isWaitingForData: false,
      streamReady: false,
    }),
    false,
  );
});

test('shouldDeferChoiceUntilStreamReady_生成中暂缓选项上屏', () => {
  assert.equal(
    shouldDeferChoiceUntilStreamReady({
      stepType: 'choice',
      streamLoading: true,
    }),
    true,
  );
});

test('shouldDeferChoiceUntilStreamReady_生成结束后展示选项', () => {
  assert.equal(
    shouldDeferChoiceUntilStreamReady({
      stepType: 'choice',
      streamLoading: false,
    }),
    false,
  );
});

test('shouldDeferChoiceUntilStreamReady_对话步不因 loading 暂缓', () => {
  assert.equal(
    shouldDeferChoiceUntilStreamReady({
      stepType: 'dialogue',
      streamLoading: true,
    }),
    false,
  );
});

test('isGenerationBusyError_识别锁冲突与生成中文案', () => {
  assert.equal(isGenerationBusyError('当前内容正在生成中，请稍后再试'), true);
  assert.equal(isGenerationBusyError('Failed to acquire lock after 10 attempts'), true);
  assert.equal(isGenerationBusyError('Action is already processing'), true);
  assert.equal(isGenerationBusyError('Session is busy'), true);
  assert.equal(isGenerationBusyError('网络错误'), false);
});

test('getGenerationBusyRetryDelayMs_随次数递增且有上限', () => {
  assert.equal(getGenerationBusyRetryDelayMs(0), 700);
  assert.equal(getGenerationBusyRetryDelayMs(1), 1400);
  assert.equal(getGenerationBusyRetryDelayMs(10), 2800);
  assert.ok(GENERATION_BUSY_MAX_RETRIES >= 3);
});
