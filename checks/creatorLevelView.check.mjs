import assert from 'node:assert/strict';
import test from 'node:test';

const viewModule = await import('../src/lib/creatorLevelView.ts').catch(() => ({}));

test('creator level labels distinguish play rounds pv and author types', () => {
  assert.equal(typeof viewModule.metricLabel, 'function');
  assert.equal(viewModule.metricLabel({ levelMetricType: 'play_round' }), '游玩轮次');
  assert.equal(viewModule.metricLabel({ levelMetricType: 'pv' }), 'PV');
  assert.equal(viewModule.authorTypeLabel('regular'), '普通作者');
  assert.equal(viewModule.authorTypeLabel('contracted'), '签约作者');
  assert.equal(viewModule.authorTypeLabel('special'), '特邀作者');
});

test('creator quarter dates render as inclusive Shanghai calendar dates', () => {
  assert.equal(
    viewModule.formatCreatorQuarterRange(
      '2026-10-01T00:00:00.000+08:00',
      '2027-01-01T00:00:00.000+08:00',
    ),
    '2026.10.01 - 2026.12.31',
  );
  assert.equal(viewModule.formatCreatorQuarterRange(null, null), '—');
});

test('progress display uses the backend threshold without exceeding one hundred percent', () => {
  assert.deepEqual(
    viewModule.creatorLevelProgress({ progressPv: 1_200, requiredPv: 5_000, progressPercent: 24 }),
    { current: 1_200, target: 5_000, percent: 24 },
  );
  assert.deepEqual(
    viewModule.creatorLevelProgress({ progressPv: 6_000, requiredPv: 5_000, progressPercent: 120 }),
    { current: 6_000, target: 5_000, percent: 100 },
  );
});
