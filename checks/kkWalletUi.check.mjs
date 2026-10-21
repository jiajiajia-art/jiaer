import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path) => readFileSync(join(root, path), 'utf8');
const kkMoneyModule = await import('../src/utils/kkMoney.ts').catch(() => null);

test('formats KK amounts with at most two visible decimal places', () => {
  assert.ok(kkMoneyModule, 'expected src/utils/kkMoney.ts to exist');
  assert.equal(kkMoneyModule.formatKk(100), '100');
  assert.equal(kkMoneyModule.formatKk(3.1), '3.1');
  assert.equal(kkMoneyModule.formatKk(3.01), '3.01');
});

test('account types expose wallet, membership, recharge, and activity metadata', () => {
  const source = readSource('src/api/account/auth.type.ts');
  assert.match(source, /export interface KkBalance/);
  assert.match(source, /kkBalance\?: KkBalance/);
  assert.match(source, /membership\?: MembershipState/);
  assert.match(source, /kkRechargePlans\?: KkRechargePlan\[\]/);
  assert.match(source, /kkFilter\?: KkActivityFilter/);
  assert.match(source, /assetCategory\?: 'recharge' \| 'gift' \| null/);
  assert.match(source, /validityType\?: 'permanent' \| 'limited' \| null/);
});

test('profile overview shows total KK coins and included limited coins', () => {
  const source = readSource('src/page/Create.tsx');
  assert.match(source, /含.*限时币/);
  assert.match(source, /kkBalance/);
  assert.match(source, /formatKk/);
});

test('asset details expose wallet breakdown and KK activity filters', () => {
  const source = readSource('src/page/AssetDetails.tsx');
  assert.match(source, /永久币/);
  assert.match(source, /限时币/);
  assert.match(source, /充值币/);
  assert.match(source, /赠币/);
  assert.match(source, /已过期/);
  assert.match(source, /kkFilter/);
  assert.match(source, /nextExpiryAt/);
});

test('recharge and membership UI only exposes the new plans and benefits', () => {
  const source = readSource('src/components/Purchase/RechargeModal.tsx');
  for (const planId of ['dr_6_v2', 'dr_30_v2', 'dr_68_v2', 'dr_128_v2', 'dr_328_v2']) {
    assert.match(source, new RegExp(planId));
  }
  assert.doesNotMatch(source, /creator_day|creator_season|creator_year/);
  assert.match(source, /首充/);
  assert.match(source, /周卡/);
  assert.match(source, /月卡/);
  assert.match(source, /85\s*折|85%|8\.5折/);
});

test('external recharge shows first-charge eligibility and bonus totals', () => {
  const source = readSource('src/page/external/ExternalRecharge.tsx');
  assert.match(source, /firstChargeEligible/);
  assert.match(source, /firstBonusDiamonds/);
  assert.match(source, /firstTotalDiamonds/);
  assert.match(source, /首充/);
});

test('sign-in UI reports permanent membership KK rewards including makeup', () => {
  const types = readSource('src/api/account/auth.type.ts');
  const checkIn = readSource('src/components/CheckInModal.tsx');
  assert.match(types, /membershipRewards/);
  assert.match(checkIn, /membershipRewards/);
  assert.match(checkIn, /永久KK币/);
});

test('admin UI configures KK validity, new memberships, and conditional activity rewards', () => {
  const kkManager = readSource('src/components/DiamondAdminManager.tsx');
  const membershipManager = readSource('src/components/SubscriptionAdminManager.tsx');
  const promotionManager = readSource('src/components/PromotionAdminManager.tsx');
  assert.match(kkManager, /永久KK币/);
  assert.match(kkManager, /限时KK币/);
  assert.match(kkManager, /自定义天数/);
  assert.match(kkManager, /step="0\.01"/);
  assert.match(membershipManager, /value="week"/);
  assert.match(membershipManager, /value="month_v2"/);
  assert.doesNotMatch(membershipManager, /creator_day|creator_season|creator_year/);
  assert.match(promotionManager, /活动限时KK币奖励/);
  assert.match(promotionManager, /kkReward\.enabled/);
  assert.match(promotionManager, /step="0\.01"/);
  assert.match(promotionManager, /validDays/);
});
