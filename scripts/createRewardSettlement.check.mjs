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

test('创作激励_创作收益与推广激励应分区展示并保留各自数据', () => {
  const incentive = read('src/page/CreatorIncentive.tsx');
  const incentiveCss = read('src/page/CreatorIncentive.module.css');
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');

  assert.match(incentive, /id="settlement-title"[^>]*>\{t\('create\.creativeRevenueTitle'\)\}/);
  assert.match(incentive, /id="promotion-incentive-title"[^>]*>\{t\('create\.promotionIncentiveTitle'\)\}/);
  assert.match(incentive, /stats\.totalAmount/);
  assert.match(incentive, /stats\.totalDiamondsAmount/);
  assert.match(incentive, /stats\.totalIncentiveAmount/);
  assert.match(incentive, /stats\.inviteTotalAmount/);
  assert.ok(incentive.indexOf('id="settlement-title"') < incentive.indexOf('id="promotion-incentive-title"'));
  assert.doesNotMatch(incentive, /new-incentive-settlement|newIncentiveSettlement/);
  assert.match(incentiveCss, /\.promotionPanel\s*\{/);
  assert.doesNotMatch(incentiveCss, /\.newIncentiveSettlement/);
  assert.match(zh, /"creativeRevenueTitle":\s*"创作收益"/);
  assert.match(zh, /"promotionIncentiveTitle":\s*"推广激励"/);
  assert.match(en, /"creativeRevenueTitle":\s*"Creation Revenue"/);
  assert.match(en, /"promotionIncentiveTitle":\s*"Promotion Incentives"/);
});

test('创作者权益_计入作品应分页且未计入作品默认收起', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');
  const zh = JSON.parse(read('src/i18n/locales/zh.json'));
  const en = JSON.parse(read('src/i18n/locales/en.json'));
  const collectStrings = (value) => {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object') return [];
    return Object.values(value).flatMap(collectStrings);
  };

  assert.match(benefits, /const INCLUDED_WORKS_PER_PAGE = 10/);
  assert.match(benefits, /works\.included\.slice\(/);
  assert.match(benefits, /const \[isExcludedExpanded, setIsExcludedExpanded\] = useState\(false\)/);
  assert.match(benefits, /aria-expanded=\{isExcludedExpanded\}/);
  assert.match(benefitsCss, /\.pagination\s*\{/);
  assert.equal(zh.creatorBenefits.playCount, '游玩量 {{count}}');
  assert.equal(en.creatorBenefits.playCount, '{{count}} plays');
  assert.doesNotMatch(collectStrings(zh.creatorBenefits).join(' '), /PV/i);
  assert.doesNotMatch(collectStrings(en.creatorBenefits).join(' '), /PV/i);
});

test('创作者权益_应可查看等级与分成说明表', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');
  const zh = JSON.parse(read('src/i18n/locales/zh.json'));

  assert.match(benefits, /IoHelpCircleOutline/);
  assert.match(benefits, /const \[isBenefitGuideOpen, setIsBenefitGuideOpen\] = useState\(false\)/);
  assert.match(benefits, /aria-modal="true"/);
  assert.match(benefits, /<table>/);
  assert.match(benefitsCss, /\.modalOverlay\s*\{/);
  assert.equal(zh.creatorBenefits.guideTitle, '创作者等级与权益');
  assert.equal(zh.creatorBenefits.guideEditorRatio, '编辑器作品分成比例');
  assert.equal(zh.creatorBenefits.guideCustomRatio, '自定义作品分成比例');
});

test('创作者权益_移动端应隐藏底部导航并支持触控滑动表格', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');

  assert.doesNotMatch(benefits, /MobileBottomNav/);
  assert.match(benefitsCss, /touch-action:\s*pan-x/);
  assert.match(benefitsCss, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(benefitsCss, /scrollbar-width:\s*thin/);
});

test('个人中心_极窄屏下创作者等级不应被其他标签挤出屏幕', () => {
  const create = read('src/page/Create.tsx');
  const createCss = read('src/page/Create.module.css');
  const badgeRowStart = create.indexOf('className={styles.creatorHeroBadgeRow}');
  const badgeRowEnd = create.indexOf('</div>', badgeRowStart);
  const badgeRow = create.slice(badgeRowStart, badgeRowEnd);

  assert.match(create, /className=\{styles\.creatorHeroIdGroup\}/);
  assert.ok(badgeRow.indexOf('creatorBenefits') < badgeRow.indexOf('isMember'));
  assert.match(createCss, /\.creatorHeroMetaRow\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(createCss, /\.creatorHeroBadgeRow\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(createCss, /\.creatorHeroId\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
  assert.match(createCss, /@media \(max-width: 1080px\)[\s\S]*?\.creatorHeroBadgeRow\s*\{[\s\S]*?flex-basis:\s*100%/);
});

test('创作者权益管理_全平台作品应默认筛选公开发布', () => {
  const manager = read('src/components/CreatorBenefitsAdminManager.tsx');

  assert.match(manager, /const \[gameStatus, setGameStatus\] = useState\('published'\)/);
  assert.match(manager, /status:\s*gameStatus \|\| undefined/);
});

test('创作者权益_移动端布局应紧凑且未计入作品可上下收起', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');

  assert.match(benefits, /className=\{styles\.collapsibleTrigger\}/);
  assert.match(benefits, /className=\{styles\.collapseFooterButton\}/);
  assert.match(benefits, /setIsExcludedExpanded\(false\)/);
  assert.match(benefitsCss, /--benefit-heading:\s*#[0-9a-f]{6}/i);
  assert.match(benefitsCss, /@media \(max-width: 720px\)[\s\S]*?\.ratioItem\s*\{[\s\S]*?grid-template-columns:/);
});

test('作品卡片_激励作品应继续显示热度而不是织梦豆', () => {
  const gameGrid = read('src/components/GameGrid.tsx');
  const gameGridCss = read('src/components/GameGrid.module.css');

  assert.doesNotMatch(gameGrid, /CardCoinIcon/);
  assert.doesNotMatch(gameGrid, /getIncentiveAmount/);
  assert.match(gameGrid, /const primaryValue = primaryStat === 'uv'/);
  assert.match(gameGrid, /<CardFlameIcon className=\{styles\.goodsInfoFlame\} \/>/);
  assert.match(gameGridCss, /\.goodsImg\s*>\s*img\s*\{/);
  assert.doesNotMatch(gameGridCss, /\.goodsImg\s+img\s*\{/);
});
