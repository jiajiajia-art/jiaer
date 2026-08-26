/**
 * 上游 LLM/生图错误文案清洗：禁止把 rix JSON / 美元额度甩给玩家
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getApiErrorMessage,
  sanitizeUpstreamLlmErrorMessage,
} from '../src/utils/error.ts';

test('sanitizeUpstreamLlmErrorMessage_额度不足友好文案', () => {
  const raw =
    'OpenAI API error: 403 - {"error":{"message":"预扣费额度失败，用户剩余额度：$ 0.000688，需要预扣费额度：$ 0.031999","type":"rix_api_error","code":"insufficient_user_quota"}}';
  const msg = sanitizeUpstreamLlmErrorMessage(raw);
  assert.match(msg, /额度不足/);
  assert.doesNotMatch(msg, /0\.000688|OpenAI API error|rix_api/);
});

test('sanitizeUpstreamLlmErrorMessage_普通文案原样返回', () => {
  assert.equal(sanitizeUpstreamLlmErrorMessage('头像生成失败'), '头像生成失败');
});

test('getApiErrorMessage_Error对象走清洗', () => {
  const err = new Error('OpenAI API error: 403 - insufficient_user_quota');
  assert.match(getApiErrorMessage(err, '失败'), /额度不足|暂时不可用/);
});

test('extractBlobErrorMessage_应解析JSON错误体', async () => {
  const { extractBlobErrorMessage, getAxiosErrorMessageAsync } = await import('../src/utils/error.ts');
  const blob = new Blob(
    [JSON.stringify({
      success: false,
      message: 'Failed to generate player image',
      error: 'Image generation timeout after 55000ms',
    })],
    { type: 'application/json' },
  );
  const msg = await extractBlobErrorMessage(blob);
  assert.equal(msg, 'Image generation timeout after 55000ms');

  const axiosLike = {
    response: { data: blob },
    message: 'Request failed with status code 500',
  };
  const toast = await getAxiosErrorMessageAsync(axiosLike, '生成失败');
  assert.match(toast, /timeout|55000/);
});

test('getAxiosErrorMessageAsync_blob无message时用error字段', async () => {
  const { getAxiosErrorMessageAsync } = await import('../src/utils/error.ts');
  const blob = new Blob(
    [JSON.stringify({ success: false, error: '生图网关暂时不可用（HTTP 503）' })],
    { type: 'application/json' },
  );
  const toast = await getAxiosErrorMessageAsync({ response: { data: blob } }, '生成失败');
  assert.match(toast, /暂时不可用/);
});
