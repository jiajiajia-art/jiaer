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

  assert.match(zh, /"accountCreatorIncentive":\s*"创作激励"/);
  assert.match(en, /"accountCreatorIncentive":\s*"Creator Incentives"/);
});
