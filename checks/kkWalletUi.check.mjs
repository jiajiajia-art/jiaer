import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path) => readFileSync(join(root, path), 'utf8');
const kkMoneyModule = await import('../src/utils/kkMoney.ts').catch(() => null);
const membershipStatusModule = await import('../src/lib/membershipStatus.ts').catch(() => null);

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
  assert.match(source, /KkValidityFilter = 'all' \| 'permanent' \| 'limited'/);
  assert.match(source, /KkAssetCategoryFilter = 'all' \| 'recharge' \| 'gift'/);
  assert.match(source, /KkEventTypeFilter = 'all' \| 'income' \| 'consume' \| 'expired' \| 'refund'/);
  assert.match(source, /validityType\?: KkValidityFilter/);
  assert.match(source, /assetCategory\?: KkAssetCategoryFilter/);
  assert.match(source, /eventType\?: KkEventTypeFilter/);
  assert.match(source, /assetCategory\?: 'recharge' \| 'gift' \| null/);
  assert.match(source, /validityType\?: 'permanent' \| 'limited' \| null/);
});

test('profile overview shows total KK coins and included limited coins', () => {
  const source = readSource('src/page/Create.tsx');
  const styles = readSource('src/page/Create.module.css');
  assert.match(source, /含.*限时币/);
  assert.match(source, /kkBalance/);
  assert.match(source, /formatKk/);
  assert.match(source, /primaryStatValueHint/);
  assert.match(source, /primaryStatLabel[^]*KK币/);
  assert.doesNotMatch(source, /KK币：.*币/);
  assert.match(styles, /\.primaryStatValueHint/);
});

test('asset details expose wallet breakdown and KK activity filters', () => {
  const source = readSource('src/page/AssetDetails.tsx');
  const styles = readSource('src/page/AssetDetails.module.css');
  assert.match(source, /永久币/);
  assert.match(source, /限时币/);
  assert.match(source, /充值币/);
  assert.match(source, /赠币/);
  assert.match(source, /已过期/);
  assert.match(source, /按有效期/);
  assert.match(source, /按来源/);
  assert.match(source, /流水类型/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /一键清除/);
  assert.match(source, /kkValidity/);
  assert.match(source, /kkAssetCategory/);
  assert.match(source, /kkEventType/);
  assert.match(source, /nextExpiryAt/);
  assert.match(source, /onClick=\{\(\) => selectCurrencyTab\(tab\.key\)\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => selectCurrencyTab\('diamonds'\)\}/);
  assert.match(source, /currencyTab === 'diamonds' \? \(\s*<section className=\{styles\.kkBreakdownSection\}/s);
  assert.ok(
    source.indexOf('aria-label="KK币余额构成"') > source.indexOf('<section className={styles.toolbar}>'),
    'KK币构成应放在币种页签与筛选栏之后',
  );
  assert.doesNotMatch(styles, /\.balanceCardButton/);
  assert.match(styles, /\.kkBreakdownSection/);
  assert.match(styles, /\.toolbar\s*\{[^}]*flex-wrap:\s*nowrap/s);
  assert.match(styles, /\.kkBreakdownButton:focus-visible/);
  assert.doesNotMatch(styles, /@media\s*\(max-width:\s*560px\)[^]*\.toolbar\s*\{[^}]*flex-direction:\s*column/s);
});

test('published AI play keeps all frontend free-round thresholds disabled at zero', () => {
  const playBilling = readSource('src/lib/galgame/playBilling.ts');
  const npcStep = readSource('src/hooks/mapGalgame/npc/useNpcInteractionStep.ts');
  const npcContainer = readSource('src/components/GalgameMap/interaction/NpcInteractionContainer.tsx');

  assert.match(playBilling, /GALGAME_FREE_ROUNDS\s*=\s*0/);
  assert.match(npcStep, /FREE_ROUNDS\s*=\s*0/);
  assert.match(npcContainer, /FREE_ROUNDS\s*=\s*0/);
});

test('discounted KK play activity shows struck original price and actual charged price responsively', () => {
  const types = readSource('src/api/account/auth.type.ts');
  const source = readSource('src/page/AssetDetails.tsx');
  const styles = readSource('src/page/AssetDetails.module.css');

  assert.match(types, /originalAmount\?: number/);
  assert.match(types, /discountPercent\?: number/);
  assert.match(source, /item\.originalAmount/);
  assert.match(source, /item\.discountPercent/);
  assert.match(source, /会员\{item\.discountPercent\}折/);
  assert.match(source, /itemOriginalAmount/);
  assert.match(source, /itemActualAmount/);
  assert.match(styles, /\.itemOriginalAmount\s*\{[^}]*text-decoration:\s*line-through/s);
  assert.match(styles, /\.itemDiscountBadge/);
  assert.match(styles, /\.itemAmountStack/);
  assert.match(styles, /@media\s*\(max-width:\s*560px\)[^]*\.itemAmountStack/s);
});

test('membership status resolves active VIP and remaining duration', () => {
  assert.ok(membershipStatusModule, 'expected src/lib/membershipStatus.ts to exist');
  const now = Date.parse('2026-10-22T00:00:00.000Z');
  const activeWeek = {
    active: true,
    planId: 'week',
    startAt: '2026-10-20T00:00:00.000Z',
    endAt: '2026-10-24T05:30:00.000Z',
  };
  const expiredMonth = {
    active: true,
    planId: 'month_v2',
    startAt: '2026-09-01T00:00:00.000Z',
    endAt: '2026-10-21T23:59:59.000Z',
  };

  assert.equal(membershipStatusModule.hasActiveVip({ week: activeWeek, month: expiredMonth, publishedPlayDiscountPercent: 15 }, now), true);
  assert.equal(membershipStatusModule.formatRemainingMembershipTime(activeWeek.endAt, now), '2天5小时');
  assert.equal(membershipStatusModule.resolveMembershipPlanStatus(activeWeek, now), 'active');
  assert.equal(membershipStatusModule.resolveMembershipPlanStatus(expiredMonth, now), 'expired');
  assert.equal(membershipStatusModule.resolveMembershipPlanStatus(null, now), 'inactive');
});

test('profile VIP badge opens separate week and month status modal', () => {
  const source = readSource('src/page/Create.tsx');
  const styles = readSource('src/page/Create.module.css');
  const modal = readSource('src/components/Profile/VipStatusModal.tsx');
  const modalStyles = readSource('src/components/Profile/VipStatusModal.module.css');

  assert.match(source, /hasActiveVip/);
  assert.match(source, /className=\{styles\.creatorVipBadge\}/);
  assert.match(source, />\s*VIP\s*</);
  assert.match(source, /<VipStatusModal/);
  assert.match(source, /setIsMembershipRechargeModalOpen\(true\)/);
  assert.match(styles, /\.creatorVipBadge/);
  assert.match(modal, /周卡/);
  assert.match(modal, /月卡/);
  assert.match(modal, /生效时间/);
  assert.match(modal, /到期时间/);
  assert.match(modal, /剩余时长/);
  assert.match(modal, /购买\/续费会员卡/);
  assert.match(modal, /正式发布的 AI 文游/);
  assert.match(modalStyles, /\.planGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
});

test('asset dropdowns share the filter row right edge with responsive widths', () => {
  const styles = readSource('src/page/AssetDetails.module.css');
  assert.match(styles, /\.filterRow\s*\{[^}]*position:\s*relative/s);
  assert.match(styles, /\.selectArea\s*\{[^}]*position:\s*static/s);
  assert.match(
    styles,
    /\.selectPopup\s*\{[^}]*top:\s*calc\(100% \+ 8px\);[^}]*right:\s*0;[^}]*min-width:\s*112px;[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*box-shadow:/s,
  );
  assert.match(
    styles,
    /\.filterPopup\s*\{[^}]*top:\s*calc\(100% \+ 8px\);[^}]*right:\s*0;[^}]*width:\s*min\(320px,\s*calc\(100vw - 24px\)\);[^}]*box-shadow:/s,
  );
  assert.match(styles, /\.kkFilterPopup\s*\{[^}]*width:\s*min\(360px,\s*calc\(100vw - 24px\)\)/s);
  assert.doesNotMatch(
    styles,
    /@media\s*\(max-width:\s*560px\)[^]*\.kkFilterPopup\s*\{[^}]*position:\s*fixed/s,
  );
});

test('recharge and membership UI only exposes the new plans and benefits', () => {
  const source = readSource('src/components/Purchase/RechargeModal.tsx');
  const styles = readSource('src/components/Purchase/RechargeModal.module.css');
  for (const planId of ['dr_6_v2', 'dr_30_v2', 'dr_68_v2', 'dr_128_v2', 'dr_328_v2']) {
    assert.match(source, new RegExp(planId));
  }
  assert.match(source, /dr_128_v2[^\n]*firstBonusDiamonds:\s*128[^\n]*firstTotalDiamonds:\s*1408/);
  assert.match(source, /dr_328_v2[^\n]*firstBonusDiamonds:\s*328[^\n]*firstTotalDiamonds:\s*3608/);
  assert.doesNotMatch(source, /creator_day|creator_season|creator_year/);
  assert.match(source, /首充/);
  assert.match(source, /周卡/);
  assert.match(source, /月卡/);
  assert.match(source, /85\s*折|85%|8\.5折/);
  assert.match(source, /rechargeTabs/);
  assert.match(source, /orderSummary/);
  assert.match(source, /confirmationPanel/);
  assert.doesNotMatch(source, /membershipStatusCard/);
  assert.doesNotMatch(source, /VIP|AI\s*排队优先/);
  assert.doesNotMatch(source, /系统自动匹配/);
  assert.match(source, /membershipBenefitsCard/);
  assert.match(source, /membershipBenefitRow/);
  assert.match(source, /membershipRulesCard/);
  assert.ok(
    source.indexOf('className={styles.plansList}') < source.indexOf('className={styles.membershipBenefitsCard}'),
    '会员套餐卡应位于会员权益卡之前',
  );
  assert.ok(
    source.indexOf('className={styles.membershipBenefitsCard}') < source.indexOf('className={styles.paymentSection}'),
    '会员权益卡应位于支付方式之前',
  );
  assert.ok(
    source.indexOf('styles.membershipSubmitBtn') < source.indexOf('className={styles.membershipRulesCard}'),
    '领取规则应位于会员支付按钮之后',
  );
  assert.match(source, /plan\.baseDiamonds\}\s*KK币/);
  assert.match(source, /首充得\s*<strong>\{planDiamonds\}/);
  assert.doesNotMatch(source, /setAmountText\(String\((?:defaultPlan|plan)\.amount\)\)/);
  assert.doesNotMatch(source, /const matchedPlan = rechargePlans/);
  assert.match(styles, /\.plansList\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styles, /@media\s*\(max-width:\s*768px\)[^]*\.plansList\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styles, /\.membershipBenefitsCard,\s*\.membershipRulesCard\s*\{[^}]*border:/s);
  assert.match(styles, /\.membershipBenefitRow\s*\{[^}]*display:\s*grid/s);
  assert.match(styles, /\.membershipRulesCard\s*\{[^}]*padding:/s);
  assert.match(source, /会员币需每日登录并完成签到后领取，到账后永久有效。/);
  assert.match(source, /周卡每日 77 币、最后一天 78 币，7 天累计 540 币。/);
  assert.match(source, /月卡每日 66 币、最后一天 86 币，30 天累计 2,000 币。/);
  assert.match(source, /周卡与月卡同时有效时分别领取；同档重复购买直接延长有效期。/);
  assert.match(source, /当日未签到不自动发放，可补签后领取对应日期奖励。/);
  assert.match(styles, /\.title\s*\{[^}]*flex-shrink:\s*0/s);
  assert.match(styles, /\.regionSummary\s*\{[^}]*flex-shrink:\s*0/s);
  assert.match(styles, /\.rechargeTabs\s*\{[^}]*flex-shrink:\s*0/s);
  assert.match(styles, /\.form\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/s);
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

test('membership admin separates records, key generation, and key usage with compact icon actions', () => {
  const source = readSource('src/components/SubscriptionAdminManager.tsx');
  const records = readSource('src/components/MembershipRecordsPanel.tsx');
  const styles = readSource('src/components/SubscriptionAdminManager.module.css');
  const api = readSource('src/api/subscriptionKeys/subscriptionKeysApi.ts');

  assert.match(source, /会员状态记录/);
  assert.match(source, /会员兑换卡密钥生成/);
  assert.match(source, /会员兑换卡使用记录/);
  assert.match(source, /直接发放给用户（Kuran号）/);
  assert.match(source, /留空则仅生成密钥，填写后将立即兑换并发放会员/);
  assert.match(source, /MdContentCopy/);
  assert.match(source, /MdLock/);
  assert.doesNotMatch(source, />\s*复制\s*</);
  assert.match(records, /生效中/);
  assert.match(records, /待生效/);
  assert.match(records, /已过期/);
  assert.match(records, /充值购买/);
  assert.match(records, /兑换卡兑换/);
  assert.match(records, /旧会员迁移/);
  assert.match(api, /listMemberships/);
  assert.match(styles, /\.adminTabs/);
  assert.match(styles, /\.iconButton/);
  assert.match(styles, /@media\s*\(max-width:\s*768px\)[^]*\.responsiveTable/s);
});

test('invite copy consistently presents the 15 limited KK three-day reward', () => {
  const zh = readSource('src/i18n/locales/zh.json');
  const en = readSource('src/i18n/locales/en.json');

  assert.doesNotMatch(zh, /双方各(?:得|获得) 30 KK币/);
  assert.match(zh, /双方各(?:得|获得) 15 限时KK币/);
  assert.match(zh, /3 天有效/);
  assert.doesNotMatch(en, /both (?:get|receive|received) 30 KK Coins/i);
  assert.match(en, /15 limited-time KK Coins/i);
  assert.match(en, /3 days/i);
});
