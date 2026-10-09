/**
 * 提现入口：从 Create 页 KK 币统计行迁移到独立创作激励页面。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_KK币统计行不再展示提现且新页面复用提现流程', () => {
  const createCss = read('src/page/Create.module.css');
  const create = read('src/page/Create.tsx');
  const incentive = read('src/page/CreatorIncentive.tsx');
  const incentiveCss = read('src/page/CreatorIncentive.module.css');

  assert.doesNotMatch(create, /primaryStatWithdrawLink|primaryStatLabelSep/);
  assert.doesNotMatch(createCss, /\.primaryStatWithdrawLink\s*\{|\.primaryStatLabelSep\s*\{/);
  assert.match(incentive, /WithdrawFlowModal/);
  assert.match(incentive, /setIsWithdrawModalOpen\(true\)/);
  assert.match(incentive, /create\.withdraw/);
  assert.match(incentiveCss, /\.withdrawButton\s*\{[\s\S]*?min-height:\s*44px/);
});
