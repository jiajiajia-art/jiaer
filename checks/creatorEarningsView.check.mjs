import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const viewModule = await import('../src/lib/creatorEarningsView.ts').catch(() => ({}));

test('withdraw action routes by profile active request and available gross', () => {
  assert.equal(typeof viewModule.resolveCreatorWithdrawAction, 'function');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: false, availableCents: 12000 }), 'profile');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: false, activeStatus: 'pending', availableCents: 12000 }), 'status');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: true, activeStatus: 'pending', availableCents: 12000 }), 'status');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: true, activeStatus: 'approved', availableCents: 12000 }), 'status');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: true, availableCents: 12000 }), 'withdraw');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: true, availableCents: 6800 }), 'exchange');
  assert.equal(viewModule.resolveCreatorWithdrawAction({ profileComplete: true, availableCents: 0 }), 'exchange');
});

test('creator work accounts merge with existing work titles by file id', () => {
  assert.equal(typeof viewModule.mergeCreatorWorkEarnings, 'function');
  const accounts = [{ fileId: 'work-1', workType: 'TXT', cumulativeYuan: '12.34' }];
  const works = [{ file_id: 'work-1', title: '再见白月光' }];
  assert.equal(viewModule.mergeCreatorWorkEarnings(accounts, works)[0].title, '再见白月光');
  assert.equal(viewModule.mergeCreatorWorkEarnings(accounts, [])[0].title, '未命名作品');
});

test('money bank and chart helpers keep display rules stable', () => {
  assert.equal(viewModule.formatYuan('128.6'), '¥128.60');
  assert.equal(viewModule.formatYuan('invalid'), '¥0.00');
  assert.equal(viewModule.maskBankAccount('6222020202020202020'), '中国银行卡（尾号 2020）');
  assert.deepEqual(viewModule.visibleTrendSeries([
    { editorGrossYuan: '0.00', customGrossYuan: '4.00', sdkGrossYuan: '0.00' },
  ]), ['custom']);
});

test('query builder omits empty filters and encodes work ids', () => {
  assert.equal(viewModule.buildCreatorEarningsQuery({ period: '30d', granularity: 'daily' }), 'period=30d&granularity=daily');
  assert.equal(
    viewModule.buildCreatorEarningsQuery({ page: 2, pageSize: 20, fileId: 'work/a b' }),
    'page=2&pageSize=20&fileId=work%2Fa+b',
  );
});

test('idempotency helper reuses one key until caller clears it', () => {
  let calls = 0;
  const factory = () => `key-${++calls}`;
  const first = viewModule.ensureCreatorEarningIdempotencyKey(null, factory);
  const retry = viewModule.ensureCreatorEarningIdempotencyKey(first, factory);
  assert.equal(first, 'key-1');
  assert.equal(retry, first);
  assert.equal(calls, 1);
});

test('creator earnings API exposes the approved read and write surface', () => {
  const source = fs.readFileSync('src/api/creatorEarnings/creatorEarningsApi.ts', 'utf8');
  for (const method of [
    'getOverview', 'listWorks', 'listLedger', 'listWithdrawals',
    'createWithdrawal', 'exchangeKk',
  ]) assert.match(source, new RegExp(`${method}\\s*:`));
  assert.match(source, /\/auth\/creator-earnings\/overview/);
  assert.match(source, /\/auth\/creator-earnings\/ledger/);
  assert.match(source, /\{\s*idempotencyKey\s*\}/);
  assert.match(source, /creatorShareCostYuan:\s*string/);
  assert.match(source, /aiUsage:/);
});

test('earning records expose only paid KK income and actual AI wallet cost', () => {
  const source = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsRecordsModal.tsx', 'utf8');
  assert.match(source, /<th>时间<\/th><th>作品<\/th><th>KK币收益<\/th><th>AI 成本（KK币）<\/th>/);
  assert.match(source, /qualifiedKkMinor/);
  assert.match(source, /chargedKkMinor/);
  assert.doesNotMatch(source, /creatorShareCostYuan/);
  assert.doesNotMatch(source, /Token 用量/);
  assert.doesNotMatch(source, /6% 税费/);
  assert.doesNotMatch(source, /亏损结转/);
});

test('creator center mounts real earnings sections and keeps promotion after works', () => {
  const source = fs.readFileSync('src/page/CreatorIncentive.tsx', 'utf8');
  assert.doesNotMatch(source, /WithdrawFlowModal/);
  for (const component of [
    'CreatorEarningsOverview', 'CreatorEarningsTrend', 'CreatorWorkEarnings',
    'CreatorEarningsWithdrawalModal', 'CreatorEarningsRecordsModal', 'CreatorProfileModal',
  ]) assert.match(source, new RegExp(`<${component}`), component);
  assert.ok(source.indexOf('<CreatorWorkEarnings') < source.indexOf('promotion-incentive-title'));
});

test('trend uses Recharts and modal flow preserves idempotency and submit locking', () => {
  const trend = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsTrend.tsx', 'utf8');
  for (const component of ['ResponsiveContainer', 'LineChart', 'XAxis', 'YAxis', 'Tooltip', 'Legend', 'Line']) {
    assert.match(trend, new RegExp(component), component);
  }
  const modal = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsWithdrawalModal.tsx', 'utf8');
  assert.match(modal, /ensureCreatorEarningIdempotencyKey/);
  assert.match(modal, /disabled=\{submitting/);
  for (const state of ['profile', 'status', 'withdraw', 'exchange']) assert.match(modal, new RegExp(state));
});

test('creator earnings styles include desktop and mobile interaction contracts', () => {
  const css = fs.readFileSync('src/components/CreatorEarnings/CreatorEarnings.module.css', 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /\.chartWrap[\s\S]*min-height:/);
  assert.match(css, /\.modalActions[\s\S]*position:\s*sticky/);
});

test('creator center matches the approved page hierarchy and hides global mobile chrome', () => {
  const page = fs.readFileSync('src/page/CreatorIncentive.tsx', 'utf8');
  const css = fs.readFileSync('src/page/CreatorIncentive.module.css', 'utf8');
  assert.match(page, /<h1>创作者中心<\/h1>/);
  assert.match(page, /className=\{styles\.desktopChrome\}/);
  assert.match(page, /<CreatorBenefitRulesModal/);
  assert.doesNotMatch(page, />续</);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.desktopChrome\s*\{[\s\S]*display:\s*none/);
});

test('earnings overview follows the hero metrics actions and records layout', () => {
  const source = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsOverview.tsx', 'utf8');
  for (const hook of [
    'overviewHero', 'overviewMetrics', 'overviewActions', 'recordsLink',
    '待结算（税前）', '提现处理中（税前）', '已到账（实收）',
    '昨日', '本月', '税前累计', '分成规则',
  ]) assert.match(source, new RegExp(hook), hook);
  assert.doesNotMatch(source, /CREATOR REVENUE/);
});

test('creator benefit rules are shared and fit every level on mobile without scrolling', () => {
  const componentPath = 'src/components/CreatorBenefits/CreatorBenefitRulesModal.tsx';
  const cssPath = 'src/components/CreatorBenefits/CreatorBenefitRulesModal.module.css';
  assert.equal(fs.existsSync(componentPath), true, 'shared rules modal component');
  assert.equal(fs.existsSync(cssPath), true, 'shared rules modal styles');
  const component = fs.readFileSync(componentPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const benefitsPage = fs.readFileSync('src/page/CreatorBenefits.tsx', 'utf8');
  for (const level of ['guideLevel1', 'guideLevel2', 'guideLevel3', 'guideLevel4', 'guideLevel5', 'guideSpecial']) {
    assert.match(component, new RegExp(level), level);
  }
  assert.match(benefitsPage, /<CreatorBenefitRulesModal/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /table-layout:\s*fixed/);
  assert.match(css, /overflow:\s*hidden/);
  assert.doesNotMatch(css, /overflow-x:\s*auto/);
});

test('empty trend is compact while populated charts retain the full canvas', () => {
  const trend = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsTrend.tsx', 'utf8');
  const css = fs.readFileSync('src/components/CreatorEarnings/CreatorEarnings.module.css', 'utf8');
  assert.match(trend, /chartEmptyCompact/);
  assert.match(trend, /产生收益后将在这里展示趋势/);
  assert.match(trend, /IoStatsChartOutline/);
  assert.match(css, /\.chartEmptyCompact\s*\{[\s\S]*min-height:\s*140px/);
  assert.match(css, /\.chartWrap\s*\{[\s\S]*min-height:\s*340px/);
});

test('work earnings keep a clean three-column hierarchy on mobile', () => {
  const work = fs.readFileSync('src/components/CreatorEarnings/CreatorWorkEarnings.tsx', 'utf8');
  const css = fs.readFileSync('src/components/CreatorEarnings/CreatorEarnings.module.css', 'utf8');
  assert.match(work, /workColumns/);
  assert.match(work, /消费流水 \{work\.chargedKkTotal\} KK币/);
  assert.match(work, /className=\{styles\.workDetailsButton\}/);
  assert.doesNotMatch(work, /每部作品的累计消费与税前分成/);
  assert.match(css, /\.workDetailsButton\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.workItem\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto/);
});

test('work selector keeps a draft choice until explicit confirmation', () => {
  const modalPath = 'src/components/CreatorEarnings/CreatorWorkSelectModal.tsx';
  assert.equal(fs.existsSync(modalPath), true, 'work selector modal');
  const modal = fs.readFileSync(modalPath, 'utf8');
  const trend = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsTrend.tsx', 'utf8');
  assert.match(modal, /draftFileId/);
  assert.match(modal, /setDraftFileId\(value\)/);
  assert.match(modal, /onConfirm\(draftFileId\)/);
  assert.match(modal, /当前已选/);
  assert.match(modal, /取消/);
  assert.match(modal, /确认/);
  assert.match(trend, /CreatorWorkSelectModal/);
  assert.match(trend, /workSelectOpen/);
  assert.doesNotMatch(trend, /<select value=\{fileId\}/);
});

test('withdrawal modal renders titled work sources bank account and in-place audit state', () => {
  const modal = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsWithdrawalModal.tsx', 'utf8');
  const shell = fs.readFileSync('src/components/CreatorEarnings/CreatorEarningsModalShell.tsx', 'utf8');
  for (const hook of ['workTitles', 'bankCard', 'bankBranch', 'submittedWithdrawal', 'setSubmittedWithdrawal']) {
    assert.match(modal, new RegExp(hook), hook);
  }
  assert.match(modal, /workTitles\[item\.fileId\]\s*\|\|\s*item\.fileId/);
  assert.match(modal, /申请已提交，等待审核/);
  assert.match(modal, /已受理，尚未到账/);
  assert.match(modal, /返回创作者中心/);
  assert.match(modal, /未达到提现金额/);
  assert.match(modal, /提取KK币/);
  assert.match(modal, /继续累计收益/);
  assert.match(modal, /disabled=\{submitting/);
  assert.match(modal, /closeDisabled=\{submitting\}/);
  assert.match(shell, /disabled=\{closeDisabled\}/);
});

test('creator center passes work titles and payout account into withdrawal modal', () => {
  const page = fs.readFileSync('src/page/CreatorIncentive.tsx', 'utf8');
  assert.match(page, /<CreatorEarningsWithdrawalModal[\s\S]*workTitles=\{workTitles\}/);
  assert.match(page, /bankCard=\{profile\.bankCard\}/);
  assert.match(page, /bankBranch=\{profile\.bankBranch\}/);
});
