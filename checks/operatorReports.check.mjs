import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildPresetRange,
  filterFhlCampaignRows,
  buildReportRequestParams,
  formatPercent,
  mergeSeriesForChart,
  shiftIsoDate,
} from '../src/utils/operatorReportChart.ts';

const operatorReportsSource = fs.readFileSync(new URL('../src/page/operator/OperatorReports.tsx', import.meta.url), 'utf8');

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

test('buildReportRequestParams omits Funloom platform filters for FHL data source', () => {
  assert.deepEqual(
    buildReportRequestParams({ startDate: '2026-09-01', endDate: '2026-09-09' }, 'funloom', 'pc'),
    { startDate: '2026-09-01', endDate: '2026-09-09', dataSource: 'funloom', platform: 'pc' },
  );
  assert.deepEqual(
    buildReportRequestParams({ startDate: '2026-09-01', endDate: '2026-09-09' }, 'fhl', 'pc'),
    { startDate: '2026-09-01', endDate: '2026-09-09', dataSource: 'fhl' },
  );
});

test('filterFhlCampaignRows keeps only the selected FHL campaign', () => {
  const rows = [
    { campaignId: 'internal_test_20260910', visits: 1 },
    { campaignId: 'unknown', visits: 1 },
  ];

  assert.deepEqual(filterFhlCampaignRows(rows, 'internal_test_20260910'), [
    { campaignId: 'internal_test_20260910', visits: 1 },
  ]);
  assert.deepEqual(filterFhlCampaignRows(rows, 'all'), rows);
});

test('FHL reports page no longer renders or loads channel analysis', () => {
  assert.equal(operatorReportsSource.includes('fhlChannelTitle'), false);
  assert.equal(operatorReportsSource.includes('fhlChannelFilter'), false);
  assert.equal(operatorReportsSource.includes('getFhlChannelBreakdown'), false);
});
