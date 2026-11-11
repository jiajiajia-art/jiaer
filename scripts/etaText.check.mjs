/**
 * 上传/生成 ETA 文案：i18n t 与 eta. 前缀两种调用都要整句同语种。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getUploadEtaText, formatEtaMinutes } from '../src/utils/etaText.ts';

const i18nT = (key) => {
  const map = {
    'eta.remaining': '剩余',
    'eta.minutes': '分钟',
    'eta.second': '秒',
    'eta.takingLonger': '耗时较长，仍在处理中，请稍候',
    remaining: '剩余',
    minutes: '分钟',
  };
  return map[key] || key;
};

test('getUploadEtaText_原始i18n_t应走eta命名空间避免remaining混排', () => {
  const text = getUploadEtaText({
    status: 'uploading',
    elapsedSeconds: 11,
    estimatedRemainingSeconds: 180,
    estimatedTotalSeconds: 300,
  }, i18nT);
  assert.equal(text, '剩余 3 分钟');
  assert.doesNotMatch(text, /remaining/i);
});

test('getUploadEtaText_eta前缀t应仍输出完整中文', () => {
  const prefixT = (key) => i18nT(`eta.${key}`);
  const text = getUploadEtaText({
    status: 'processing',
    estimatedRemainingSeconds: 45,
  }, prefixT);
  assert.equal(text, '剩余 45 秒');
});

test('getUploadEtaText_完成或失败应为空', () => {
  assert.equal(getUploadEtaText({ status: 'completed', estimatedRemainingSeconds: 90 }, i18nT), '');
  assert.equal(getUploadEtaText({ status: 'failed', estimatedRemainingSeconds: 90 }, i18nT), '');
});

test('formatEtaMinutes_缺key时回退中文单位', () => {
  const missingT = (key) => key;
  assert.equal(formatEtaMinutes(180, missingT), '3 分钟');
  assert.doesNotMatch(formatEtaMinutes(180, missingT), /minutes/i);
});
