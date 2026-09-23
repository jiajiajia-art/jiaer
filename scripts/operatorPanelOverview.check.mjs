/**
 * 运营全站统计：overview 加载中不得展示 0，且需重试
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('OperatorPanel_overview_有loading与重试', () => {
  const src = readFileSync(join(root, 'src/page/operator/OperatorPanel.tsx'), 'utf8');
  assert.match(src, /overviewLoading/);
  assert.match(src, /overviewLoadFailed/);
  assert.match(src, /loadOverview/);
  assert.match(src, /statsOverviewLoadFailed/);
  assert.match(src, /loading=\{overviewLoading\}/);
});

test('OperatorPanel_stats_overview与works分effect且翻页不重拉overview依赖', () => {
  const src = readFileSync(join(root, 'src/page/operator/OperatorPanel.tsx'), 'utf8');
  assert.match(src, /\[activeTab, loadOverview\]/);
  assert.match(src, /\[activeTab, loadWorks\]/);
});

test('StatsOverviewSection_loading时不应直接渲染0占位', () => {
  const src = readFileSync(join(root, 'src/components/stats/StatsOverviewSection.tsx'), 'utf8');
  assert.match(src, /loading\?: boolean/);
  assert.match(src, /statsOverviewLoading/);
  assert.match(src, /loadFailed/);
});

test('operatorStatsApi_overview_显式长超时', () => {
  const src = readFileSync(join(root, 'src/api/stats/operatorStatsApi.ts'), 'utf8');
  assert.match(src, /timeout:\s*120_000/);
});

test('operatorStatsApi_overview与works_应合并进行中请求', () => {
  const src = readFileSync(join(root, 'src/api/stats/operatorStatsApi.ts'), 'utf8');
  assert.match(src, /dedupeInflight\(overviewInflight/);
  assert.match(src, /dedupeInflight\(worksInflight/);
});
