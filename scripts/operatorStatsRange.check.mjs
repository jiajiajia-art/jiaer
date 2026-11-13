/**
 * 运营全站统计 URL preset 归一化：未知 preset 不作为合法 URL 值（带日期 → custom，否则 → all）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
// 业务模块有无后缀 / 目录导入（'./constants'），先注册测试解析钩子再动态加载
await import('./_tsResolve.mjs');
const { parseOperatorStatsQuery } = await import('../src/utils/operatorStatsRange.ts');

// 本周 / 本月 / 上月已重新上线（有文案、区间与环比），属于合法 preset，原样保留
test('preset=thisWeek/thisMonth/lastMonth 保持不变', () => {
  for (const p of ['thisWeek', 'thisMonth', 'lastMonth']) {
    assert.equal(parseOperatorStatsQuery(`?preset=${p}`).preset, p);
  }
});

test('合法 preset 带日期时仍以 preset 为准', () => {
  const parsed = parseOperatorStatsQuery('?preset=lastMonth&startDate=2026-10-01&endDate=2026-10-31');
  assert.equal(parsed.preset, 'lastMonth');
});

test('preset=unknown 且无日期 → all', () => {
  assert.equal(parseOperatorStatsQuery('?preset=unknown').preset, 'all');
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
