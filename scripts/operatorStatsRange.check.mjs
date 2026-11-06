/**
 * 运营全站统计 URL preset 归一化：下线/未知 preset 不作为合法 URL 值。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOperatorStatsQuery } from '../src/utils/operatorStatsRange.ts';

test('preset=lastMonth → all', () => {
  assert.equal(parseOperatorStatsQuery('?preset=lastMonth').preset, 'all');
});

test('preset=thisWeek → all', () => {
  assert.equal(parseOperatorStatsQuery('?preset=thisWeek').preset, 'all');
});

test('preset=thisMonth → all', () => {
  assert.equal(parseOperatorStatsQuery('?preset=thisMonth').preset, 'all');
});

test('preset=lastMonth&startDate=... → custom', () => {
  const parsed = parseOperatorStatsQuery('?preset=lastMonth&startDate=2026-10-01&endDate=2026-10-31');
  assert.equal(parsed.preset, 'custom');
  assert.equal(parsed.startDate, '2026-10-01');
  assert.equal(parsed.endDate, '2026-10-31');
});

test('preset=unknown&startDate=... → custom', () => {
  const parsed = parseOperatorStatsQuery('?preset=unknown&startDate=2026-11-01&endDate=2026-11-06');
  assert.equal(parsed.preset, 'custom');
  assert.equal(parsed.startDate, '2026-11-01');
});

test('合法 URL preset 保持不变', () => {
  assert.equal(parseOperatorStatsQuery('?preset=today').preset, 'today');
  assert.equal(parseOperatorStatsQuery('?preset=all').preset, 'all');
  assert.equal(parseOperatorStatsQuery('?preset=custom&startDate=2026-01-01&endDate=2026-01-07').preset, 'custom');
});
