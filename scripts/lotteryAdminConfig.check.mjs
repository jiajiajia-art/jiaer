/**
 * 抽奖后台配置：上海时间与一等奖概率文案
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFirstPrizeOddsHint,
  fromShanghaiDatetimeLocal,
  toShanghaiDatetimeLocal,
} from '../src/activities/funloom-lottery-20260731/lib/lotteryAdminConfig.ts';

test('toShanghaiDatetimeLocal_UTC应转为上海墙钟', () => {
  // 2026-07-30 16:00 UTC = 2026-07-31 00:00 CST
  assert.equal(toShanghaiDatetimeLocal('2026-07-30T16:00:00.000Z'), '2026-07-31T00:00');
});

test('fromShanghaiDatetimeLocal_应转回UTC', () => {
  assert.equal(fromShanghaiDatetimeLocal('2026-07-31T00:00'), '2026-07-30T16:00:00.000Z');
});

test('formatFirstPrizeOddsHint_未配置应提示永远不中', () => {
  assert.match(formatFirstPrizeOddsHint(0), /永远抽不中/);
  assert.match(formatFirstPrizeOddsHint(1), /1\/3000/);
});
