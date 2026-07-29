import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPresetRange,
  formatPercent,
  mergeSeriesForChart,
  shiftIsoDate,
} from '../src/utils/operatorReportChart.ts';

test('mergeSeriesForChart merges multiple series by bucket', () => {
  const merged = mergeSeriesForChart([
    {
      key: 'pv',
      label: 'PV',
      points: [
        { bucket: '2026-07-01', value: 10 },
        { bucket: '2026-07-02', value: 20 },
      ],
    },
    {
      key: 'share',
      label: 'Share',
      points: [
        { bucket: '2026-07-02', value: 3 },
      ],
    },
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].pv, 10);
  assert.equal(merged[1].pv, 20);
  assert.equal(merged[1].share, 3);
});

test('buildPresetRange returns inclusive day span', () => {
  const range = buildPresetRange(7);
  assert.equal(shiftIsoDate(range.endDate, -6), range.startDate);
});

test('formatPercent renders signed percentage', () => {
  assert.equal(formatPercent(0.156), '15.6%');
  assert.equal(formatPercent(null), '—');
});
