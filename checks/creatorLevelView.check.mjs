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
  assert.deepEqual(
    viewModule.creatorLevelProgress({ progressPv: 52, requiredPv: 100_000, progressPercent: 0.052 }),
    { current: 52, target: 100_000, percent: 0.052 },
  );
  assert.equal(viewModule.formatCreatorProgressPercent(0.052), '0.052%');
  assert.equal(viewModule.formatCreatorProgressPercent(0.1), '0.1%');
  assert.equal(viewModule.formatCreatorProgressPercent(24), '24%');
});

test('included works use the existing platform mode groups', () => {
  const works = [
    { fileId: 'txt', engine: 'TXT' },
    { fileId: 'rpg', engine: 'RPG' },
    { fileId: 'st', engine: 'ST' },
    { fileId: 'sdk-custom', engine: 'CUSTOM' },
    { fileId: 'ivg', engine: 'IVG' },
    { fileId: 'novel', engine: 'NOVEL' },
  ];

  assert.deepEqual(
    viewModule.filterCreatorBenefitWorksByMode(works, 'role-playing').map((work) => work.fileId),
    ['txt', 'rpg'],
  );
  assert.deepEqual(
    viewModule.filterCreatorBenefitWorksByMode(works, 'world').map((work) => work.fileId),
    ['st'],
  );
  assert.deepEqual(
    viewModule.filterCreatorBenefitWorksByMode(works, 'custom').map((work) => work.fileId),
    ['sdk-custom'],
  );
  assert.deepEqual(viewModule.filterCreatorBenefitWorksByMode(works, 'all'), works);
});

test('creator works sort by contribution descending without changing equal-value order', () => {
  const works = [
    { fileId: 'low', quarterMetricCount: 2 },
    { fileId: 'tie-a', quarterMetricCount: 8 },
    { fileId: 'high', quarterMetricCount: 13 },
    { fileId: 'tie-b', quarterMetricCount: 8 },
  ];

  assert.deepEqual(
    viewModule.sortCreatorBenefitWorksByContribution(works).map((work) => work.fileId),
    ['high', 'tie-a', 'tie-b', 'low'],
  );
  assert.deepEqual(works.map((work) => work.fileId), ['low', 'tie-a', 'high', 'tie-b']);
});
