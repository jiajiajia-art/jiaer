/**
 * 抽奖后台：分页偏移 / 导出成功文案
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_DRAWS_PAGE_SIZE,
  formatAdminExportSuccessMessage,
  formatFirstPrizeOddsHint,
  fromShanghaiDatetimeLocal,
  resolveAdminDrawsOffset,
  resolveAdminDrawsTotalPages,
  toShanghaiDatetimeLocal,
} from '../src/activities/funloom-lottery-20260731/lib/lotteryAdminConfig.ts';

test('toShanghaiDatetimeLocal_UTC应转为上海墙钟', () => {
  assert.equal(toShanghaiDatetimeLocal('2026-07-30T16:00:00.000Z'), '2026-07-31T00:00');
});

test('fromShanghaiDatetimeLocal_应转回UTC', () => {
  assert.equal(fromShanghaiDatetimeLocal('2026-07-31T00:00'), '2026-07-30T16:00:00.000Z');
});

test('formatFirstPrizeOddsHint_未配置应提示永远不中', () => {
  assert.match(formatFirstPrizeOddsHint(0), /永远抽不中/);
  assert.match(formatFirstPrizeOddsHint(1), /1\/3000/);
});

test('resolveAdminDrawsOffset_页码从1开始', () => {
  assert.equal(resolveAdminDrawsOffset(1), 0);
  assert.equal(resolveAdminDrawsOffset(2), ADMIN_DRAWS_PAGE_SIZE);
  assert.equal(resolveAdminDrawsOffset(3, 20), 40);
  assert.equal(resolveAdminDrawsOffset(0), 0);
  assert.equal(resolveAdminDrawsOffset(-1), 0);
});

test('resolveAdminDrawsTotalPages_空数据至少1页', () => {
  assert.equal(resolveAdminDrawsTotalPages(0), 1);
  assert.equal(resolveAdminDrawsTotalPages(50), 1);
  assert.equal(resolveAdminDrawsTotalPages(51), 2);
  assert.equal(resolveAdminDrawsTotalPages(1276, 50), 26);
});

test('formatAdminExportSuccessMessage_一致与不一致', () => {
  assert.equal(formatAdminExportSuccessMessage(1276, 1276), '已导出全部 1276 条记录');
  assert.match(formatAdminExportSuccessMessage(500, 1276), /请核对/);
  assert.equal(formatAdminExportSuccessMessage(12), '已导出全部 12 条记录');
});
