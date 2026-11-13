/**
 * 运营全站统计 URL preset：还原周/月可视化后须原样保留合法值。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOperatorStatsQuery } from '../src/utils/operatorStatsQuery.ts';

test('preset=lastMonth 保持 lastMonth（禁止再归一成 all）', () => {
  assert.equal(parseOperatorStatsQuery('?preset=lastMonth').preset, 'lastMonth');
});

test('preset=thisWeek 保持 thisWeek', () => {
  assert.equal(parseOperatorStatsQuery('?preset=thisWeek').preset, 'thisWeek');
});

test('preset=thisMonth 保持 thisMonth', () => {
  assert.equal(parseOperatorStatsQuery('?preset=thisMonth').preset, 'thisMonth');
});

test('preset=lastMonth 带日期仍保留 lastMonth', () => {
  const parsed = parseOperatorStatsQuery('?preset=lastMonth&startDate=2026-10-01&endDate=2026-10-31');
  assert.equal(parsed.preset, 'lastMonth');
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

test('无 preset 时默认 all', () => {
  assert.equal(parseOperatorStatsQuery('').preset, 'all');
  assert.equal(parseOperatorStatsQuery('?sortBy=uv').preset, 'all');
});
