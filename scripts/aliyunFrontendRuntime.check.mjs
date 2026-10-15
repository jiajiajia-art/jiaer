/**
 * Aliyun 前端运行时门闩：CF 构建不得误开兼容逻辑
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAliyunFrontendRuntime } from '../src/lib/aliyunFrontendRuntime.ts';

test('isAliyunFrontendRuntime_国内kurangames.cn为true', () => {
  assert.equal(isAliyunFrontendRuntime('https://kurangames.cn', '', ''), true);
  assert.equal(isAliyunFrontendRuntime('https://kurangames.cn/funloom', '', ''), true);
});

test('isAliyunFrontendRuntime_CF_api域名为false', () => {
  assert.equal(isAliyunFrontendRuntime('https://api.kurangames.com', '', ''), false);
  assert.equal(isAliyunFrontendRuntime('https://api-test2.kurangames.com', '', ''), false);
  assert.equal(isAliyunFrontendRuntime('https://api-overseas.kurangames.com', '', ''), false);
});

test('isAliyunFrontendRuntime_VITE_RUNTIME优先', () => {
  assert.equal(isAliyunFrontendRuntime('https://api.kurangames.com', 'aliyun', ''), true);
  assert.equal(isAliyunFrontendRuntime('https://kurangames.cn', 'cf', ''), true);
});

test('isAliyunFrontendRuntime_cn-test与ECS_IP', () => {
  assert.equal(isAliyunFrontendRuntime('http://47.93.42.104/cn-test-api', '', ''), true);
  assert.equal(isAliyunFrontendRuntime('', '', ''), false);
});

test('isAliyunFrontendRuntime_页面hostname国内站为true', () => {
  assert.equal(isAliyunFrontendRuntime('https://api.kurangames.com', '', 'kurangames.cn'), true);
  assert.equal(isAliyunFrontendRuntime('', '', '47.93.42.104'), true);
  assert.equal(isAliyunFrontendRuntime('https://api.kurangames.com', '', 'play.kurangames.com'), false);
});
