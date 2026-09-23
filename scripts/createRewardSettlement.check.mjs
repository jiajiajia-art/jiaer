/**
 * Create 页：奖励结算入口在「我的账户」，详情走模态框；禁止页内常驻收益条与「个人中心」标题回退。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_奖励结算应从账户入口打开模态框且去掉个人中心标题', () => {
  const tsx = read('src/page/Create.tsx');
  const css = read('src/page/Create.module.css');
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');

  assert.match(tsx, /create\.accountRewardSettlement/);
  assert.match(tsx, /setIsEarningsModalOpen\(true\)/);
  assert.match(tsx, /styles\.earningsModalOverlay/);
  assert.match(tsx, /styles\.earningsModal/);
  assert.match(tsx, /styles\.earningsModalCloseIcon/);
  assert.doesNotMatch(tsx, /nav\.profile/);
  assert.doesNotMatch(tsx, /styles\.pageHeader/);
  assert.doesNotMatch(tsx, /earningsPanelWrap/);
  assert.doesNotMatch(tsx, /isEarningsMoreExpanded/);

  assert.match(css, /\.accountActionGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /\.earningsModalCloseBtn\s*\{[^}]*left:\s*12px/);
  assert.match(css, /\.earningsModalTitle\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(css, /\.earningsModal\s*\{[\s\S]*?width:\s*min\(322px/);
  assert.match(css, /\.earningsModal::before\s*\{/);
  assert.match(css, /\.earningsModalCloseIcon\s*\{/);
  assert.doesNotMatch(css, /\.earningsPanelWrap\s*\{/);
  assert.doesNotMatch(css, /\.pageHeader\s*\{/);

  assert.match(zh, /"accountRewardSettlement":\s*"奖励结算"/);
  assert.match(en, /"accountRewardSettlement":\s*"Reward Settlement"/);
});
