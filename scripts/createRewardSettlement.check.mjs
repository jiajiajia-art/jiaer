/**
 * 创作激励：Create 页只保留页面入口，结算能力集中到独立收益面板。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_创作激励应跳转独立页面且删除旧收益弹窗', () => {
  const app = read('src/App.tsx');
  const create = read('src/page/Create.tsx');
  const incentive = read('src/page/CreatorIncentive.tsx');
  const css = read('src/page/Create.module.css');
  const incentiveCss = read('src/page/CreatorIncentive.module.css');
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');

  assert.match(app, /path="\/create\/incentives"/);
  assert.match(create, /navigate\('\/create\/incentives'\)/);
  assert.match(create, /create\.accountCreatorIncentive/);
  assert.doesNotMatch(create, /isEarningsModalOpen|earningsModalOverlay|earningsModalCloseIcon/);
  assert.doesNotMatch(css, /\.earningsModal(?:Overlay|CloseBtn|Title|CloseIcon)?\s*\{/);

  assert.match(incentive, /statisticsApi\.getALLGameStats/);
  assert.match(incentive, /settlePoints\('points'\)/);
  assert.match(incentive, /settlePoints\('diamonds'\)/);
  assert.match(incentive, /data-testid="creator-incentive-overview"/);
  assert.match(incentive, /data-testid="creator-incentive-chart"/);
  assert.match(incentive, /data-testid="creator-incentive-works"/);
  assert.match(incentive, /const WORK_TABS/);
  assert.match(incentive, /const WORKS_PER_PAGE = 6/);
  assert.match(incentive, /role="tablist"/);
  assert.match(incentive, /aria-selected=/);
  assert.match(incentive, /styles\.pagination/);
  assert.match(incentiveCss, /\.analyticsPanel\s*\{/);
  assert.match(incentiveCss, /\.workTabs\s*\{/);
  assert.match(incentiveCss, /\.workGrid\s*\{/);

  assert.match(zh, /"accountCreatorIncentive":\s*"创作激励"/);
  assert.match(en, /"accountCreatorIncentive":\s*"Creator Incentives"/);
});

test('创作激励_新激励待结算KK币应独立占位且不调用旧结算', () => {
  const incentive = read('src/page/CreatorIncentive.tsx');
  const incentiveCss = read('src/page/CreatorIncentive.module.css');
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');

  assert.match(incentive, /data-testid="new-incentive-settlement"/);
  assert.match(incentive, /className=\{styles\.newIncentiveSettlementButton\}[\s\S]*?disabled/);
  const start = incentive.indexOf('data-testid="new-incentive-settlement"');
  const end = incentive.indexOf('</section>', start);
  const newSettlementSection = incentive.slice(start, end);
  assert.doesNotMatch(newSettlementSection, /onClick=/);
  assert.ok(start < incentive.indexOf('id="settlement-title"'));
  assert.match(incentiveCss, /\.newIncentiveSettlementPanel\s*\{/);
  assert.match(zh, /"newIncentiveSettlementTitle":\s*"新激励待结算 KK币"/);
  assert.match(en, /"newIncentiveSettlementTitle":\s*"New incentive KK coins pending settlement"/);
});
