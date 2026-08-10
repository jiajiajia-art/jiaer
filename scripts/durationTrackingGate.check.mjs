import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireGameDurationTracking,
  isGameDurationTrackingActive,
} from '../src/lib/durationTrackingGate.ts';

test('acquireGameDurationTracking_互斥计数', () => {
  assert.equal(isGameDurationTrackingActive(), false);
  const release1 = acquireGameDurationTracking();
  assert.equal(isGameDurationTrackingActive(), true);
  const release2 = acquireGameDurationTracking();
  assert.equal(isGameDurationTrackingActive(), true);
  release1();
  assert.equal(isGameDurationTrackingActive(), true);
  release2();
  assert.equal(isGameDurationTrackingActive(), false);
  // 重复释放不应把计数打成负数
  release2();
  assert.equal(isGameDurationTrackingActive(), false);
});
