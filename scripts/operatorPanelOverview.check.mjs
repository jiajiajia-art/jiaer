/**
 * 运营全站统计：面板委托 OperatorSiteStats；KPI 加载中不得展示 0，且需重试
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('OperatorPanel_stats_委托OperatorSiteStats', () => {
  const src = readFileSync(join(root, 'src/page/operator/OperatorPanel.tsx'), 'utf8');
  assert.match(src, /import OperatorSiteStats from '\.\/OperatorSiteStats'/);
  assert.match(src, /activeTab === 'stats' \? <OperatorSiteStats \/>/);
  // 功能注释：旧面板内 overview/works 拉取已下沉，禁止再在 Panel 内重复拉统计。
  assert.doesNotMatch(src, /overviewLoading/);
  assert.doesNotMatch(src, /loadWorks/);
});

test('OperatorSiteStats_overview_有loading与重试', () => {
  const src = readFileSync(join(root, 'src/page/operator/OperatorSiteStats.tsx'), 'utf8');
  assert.match(src, /overviewLoading/);
  assert.match(src, /overviewFailed/);
  assert.match(src, /statsOverviewLoadFailed/);
  assert.match(src, /loading=\{overviewLoading\}/);
  assert.match(src, /loadFailed=\{overviewFailed\}/);
  assert.match(src, /onRetry=\{/);
});

test('OperatorSiteStats_overview与works分effect且互不阻塞', () => {
  const src = readFileSync(join(root, 'src/page/operator/OperatorSiteStats.tsx'), 'utf8');
  // 功能注释：区间 KPI 与作品列表应分 effect，翻页只触发 works。
  assert.match(src, /loadOverview/);
  assert.match(src, /loadWorks/);
  assert.match(src, /setOverviewLoading/);
  assert.match(src, /setWorksLoading/);
});

test('OperatorStatsKpiGrid_loading时不应直接渲染0占位', () => {
  const src = readFileSync(join(root, 'src/components/stats/OperatorStatsKpiGrid.tsx'), 'utf8');
  assert.match(src, /loading\?: boolean/);
  assert.match(src, /statsOverviewLoading/);
  assert.match(src, /loadFailed/);
  assert.match(src, /onRetry/);
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
