/**
 * 提现入口：从 Create 页 KK 币统计行迁移到独立创作者中心（CreatorEarnings 提现弹窗）。
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

  assert.doesNotMatch(create, /primaryStatWithdrawLink|primaryStatLabelSep/);
  assert.doesNotMatch(createCss, /\.primaryStatWithdrawLink\s*\{|\.primaryStatLabelSep\s*\{/);
  // 功能注释：创作者中心用 CreatorEarningsWithdrawalModal，不再用旧 WithdrawFlowModal
  assert.match(incentive, /CreatorEarningsWithdrawalModal/);
  assert.match(incentive, /onWithdraw=\{\(\) => setWithdrawOpen\(true\)\}|setWithdrawOpen\(true\)/);
});
