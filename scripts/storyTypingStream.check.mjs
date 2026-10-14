/**
 * 流式打字续写判断：增长续打、换段重置
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isStreamingTextExtension } from '../src/lib/story/storyTypingStream.ts';

test('isStreamingTextExtension_相同或前缀增长应续打', () => {
  assert.equal(isStreamingTextExtension('你缓', '你缓'), true);
  assert.equal(isStreamingTextExtension('你缓', '你缓缓退'), true);
  assert.equal(isStreamingTextExtension('你缓缓退', '你缓缓退到墙角'), true);
});

test('isStreamingTextExtension_换段或缩短应重置', () => {
  assert.equal(isStreamingTextExtension('你缓缓退', '他转身离开'), false);
  assert.equal(isStreamingTextExtension('你缓缓退到墙角', '你缓缓退'), false);
  assert.equal(isStreamingTextExtension('', '开场'), false);
  assert.equal(isStreamingTextExtension('已有', ''), false);
});
