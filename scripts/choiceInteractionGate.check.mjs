/**
 * 选项点击门闩 + 选项上屏时机
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { canSubmitChoiceInteraction } from '../src/lib/galgame/choiceInteractionGate.ts';
import {
  GENERATION_BUSY_MAX_RETRIES,
  NETWORK_STREAM_MAX_RETRIES,
  getGenerationBusyRetryDelayMs,
  getNetworkStreamRetryDelayMs,
  isGenerationBusyError,
  shouldAutoPromoteReadyChoice,
  shouldClearCurrentStepWhenDeferringChoice,
  shouldDeferChoiceUntilStreamReady,
} from '../src/lib/galgame/choiceStepDisplayGate.ts';
import { resolveChoiceStepPromptMessage } from '../src/lib/galgame/choiceStepPrompt.ts';

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

test('shouldClearCurrentStepWhenDeferringChoice_CF清空_Aliyun保留', () => {
  assert.equal(shouldClearCurrentStepWhenDeferringChoice(false), true);
  assert.equal(shouldClearCurrentStepWhenDeferringChoice(true), false);
});

test('shouldAutoPromoteReadyChoice_仅Aliyun在旁白后衔choice', () => {
  assert.equal(
    shouldAutoPromoteReadyChoice({
      aliyunRuntime: false,
      currentStepType: 'narration',
      nextStepType: 'choice',
      streamLoading: false,
      hasCurrentStep: true,
      isWaitingForData: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoPromoteReadyChoice({
      aliyunRuntime: true,
      currentStepType: 'narration',
      nextStepType: 'choice',
      streamLoading: false,
      hasCurrentStep: true,
      isWaitingForData: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoPromoteReadyChoice({
      aliyunRuntime: true,
      currentStepType: 'narration',
      nextStepType: 'choice',
      streamLoading: true,
      hasCurrentStep: true,
      isWaitingForData: false,
    }),
    false,
  );
});

test('resolveChoiceStepPromptMessage_description优先_content回退', () => {
  assert.equal(
    resolveChoiceStepPromptMessage({ description: '请抉择', content: '旁白正文' }),
    '请抉择',
  );
  assert.equal(
    resolveChoiceStepPromptMessage({ content: '旁白正文' }),
    '旁白正文',
  );
  assert.equal(
    resolveChoiceStepPromptMessage({ title: '抉择', content: '月下' }),
    '抉择\n月下',
  );
  assert.equal(resolveChoiceStepPromptMessage({}), '请选择你的行动');
});

test('networkStreamRetry_退避应长于锁冲突且次数有限', () => {
  assert.equal(NETWORK_STREAM_MAX_RETRIES, 2);
  assert.ok(getNetworkStreamRetryDelayMs(0) >= getGenerationBusyRetryDelayMs(0));
  assert.ok(getNetworkStreamRetryDelayMs(2) <= 4000);
  assert.ok(GENERATION_BUSY_MAX_RETRIES >= 1);
});
