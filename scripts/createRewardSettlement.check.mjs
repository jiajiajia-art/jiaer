/**
 * 创作激励：Create 页只保留页面入口，结算能力集中到独立收益面板。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

  assert.match(benefits, /const INCLUDED_WORKS_PER_PAGE = 5/);
  assert.match(benefits, /filteredIncludedWorks\.slice\(/);
  assert.match(benefits, /const \[includedMode, setIncludedMode\] = useState/);
  assert.match(benefits, /<CreatorBenefitModeFilter/);
  assert.match(benefits, /const \[isExcludedExpanded, setIsExcludedExpanded\] = useState\(false\)/);
  assert.match(benefits, /aria-expanded=\{isExcludedExpanded\}/);
  assert.match(benefitsCss, /\.pagination\s*\{/);
  assert.equal(zh.creatorBenefits.playCount, '游玩量 {{count}}');
  assert.equal(en.creatorBenefits.playCount, '{{count}} plays');
  assert.doesNotMatch(collectStrings(zh.creatorBenefits).join(' '), /PV/i);
  assert.doesNotMatch(collectStrings(en.creatorBenefits).join(' '), /PV/i);
});

test('创作者权益_未计入作品按成长值排序后独立分页且每页十个', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');

  assert.match(benefits, /const EXCLUDED_WORKS_PER_PAGE = 10/);
  assert.match(benefits, /const \[excludedPage, setExcludedPage\] = useState\(1\)/);
  assert.match(benefits, /sortCreatorBenefitWorksByContribution\(works\.excluded\)[\s\S]*?paginatedExcludedWorks = sortedExcludedWorks\.slice\(/);
  assert.match(benefits, /setExcludedPage\(\(page\) => Math\.min\(page, excludedPageCount\)\)/);
  assert.match(benefits, /renderWorkRows\(paginatedExcludedWorks\)/);
  assert.match(benefits, /excludedPageCount > 1[\s\S]*?setExcludedPage/);
});

test('创作者权益_计入作品按平台模式筛选并每页显示五个', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const modeFilter = read('src/components/CreatorBenefits/CreatorBenefitModeFilter.tsx');

  assert.match(benefits, /const INCLUDED_WORKS_PER_PAGE = 5/);
  assert.match(benefits, /filterCreatorBenefitWorksByMode\(sortedIncludedWorks, includedMode\)/);
  assert.match(benefits, /filteredIncludedWorks\.slice\(/);
  assert.match(benefits, /<CreatorBenefitModeFilter/);
  assert.match(modeFilter, /HOME_LIST_MODE_OPTIONS\.map/);
  assert.match(modeFilter, /aria-haspopup="listbox"/);
  assert.match(modeFilter, /role="listbox"/);
  assert.doesNotMatch(modeFilter, /<select/);
  assert.match(benefits, /setIncludedPage\(1\)/);
});

test('创作者权益_全部作品按成长值降序后再筛选分页', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');

  assert.match(
    benefits,
    /sortCreatorBenefitWorksByContribution\(works\.included\)[\s\S]*?filterCreatorBenefitWorksByMode/,
  );
  assert.match(benefits, /sortCreatorBenefitWorksByContribution\(works\.excluded\)/);
  assert.match(benefits, /renderWorkRows\(paginatedExcludedWorks\)/);
  assert.match(benefits, /filteredIncludedWorks\.slice\(/);
});

test('创作者权益_移动端隐藏全局栏并精简居中标题与等级摘要', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');

  assert.match(benefits, /className=\{styles\.desktopChrome\}><Navbar/);
  assert.match(benefits, /<CenteredPageHeader/);
  assert.doesNotMatch(benefits, /creatorBenefits\.subtitle/);
  assert.doesNotMatch(benefits, /contractedTitle|contractedHint|specialTitle|specialHint|unrankedTitle|unrankedHint|levelTitle|levelHint/);
  assert.doesNotMatch(benefits, /className=\{styles\.pageHeader\}|className=\{styles\.backButton\}/);
  assert.match(benefitsCss, /@media \(max-width: 720px\)[\s\S]*?\.desktopChrome\s*\{[\s\S]*?display:\s*none/);
});

test('账户与创作者页面复用同一居中页头', () => {
  const componentPath = 'src/components/Layout/CenteredPageHeader.tsx';
  const componentCssPath = 'src/components/Layout/CenteredPageHeader.module.css';
  const pagePaths = [
    'src/page/CreatorBenefits.tsx',
    'src/page/CreatorIncentive.tsx',
    'src/page/EarnPoints.tsx',
    'src/page/AssetDetails.tsx',
    'src/page/InteractiveVideoPurchased.tsx',
  ];

  assert.equal(existsSync(join(root, componentPath)), true);
  assert.equal(existsSync(join(root, componentCssPath)), true);

  const component = read(componentPath);
  const componentCss = read(componentCssPath);
  const pages = pagePaths.map(read);

  pages.forEach((page) => {
    assert.match(page, /import CenteredPageHeader from/);
    assert.match(page, /<CenteredPageHeader/);
  });
  assert.match(component, /aria-label=\{backLabel\}/);
  assert.match(component, /rightAction/);
  assert.match(componentCss, /grid-template-columns:\s*44px minmax\(0, 1fr\) 44px/);
  assert.match(componentCss, /\.title\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(componentCss, /\.backButton[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(pages[4], /rightAction=\{\{/);
});

test('创作者权益_模式菜单使用页面内暗色弹层并支持关闭', () => {
  const modeFilter = read('src/components/CreatorBenefits/CreatorBenefitModeFilter.tsx');
  const modeFilterCss = read('src/components/CreatorBenefits/CreatorBenefitModeFilter.module.css');

  assert.match(modeFilter, /categories\.mode/);
  assert.match(modeFilter, /event\.key === 'Escape'/);
  assert.match(modeFilter, /document\.addEventListener\('pointerdown'/);
  assert.match(modeFilterCss, /\.menu\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(modeFilterCss, /background:\s*#(?:171719|202023)/);
});

test('创作者权益_用户页只展示成长值并隐藏季度统计明细与权益说明', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');
  const zh = JSON.parse(read('src/i18n/locales/zh.json'));
  const en = JSON.parse(read('src/i18n/locales/en.json'));

  assert.match(benefits, /creatorBenefits\.growthValue/);
  assert.doesNotMatch(benefits, /creatorBenefits\.(?:quarterTitle|txtPlayRounds|otherModePv|quarterHint|ratioHint)/);
  assert.doesNotMatch(benefits, /className=\{styles\.(?:quarterSection|quarterGrid|quarterNote)\}/);
  assert.doesNotMatch(benefitsCss, /\.quarter(?:Section|Grid|Note)/);
  assert.equal(zh.creatorBenefits.growthValue, '成长值');
  assert.equal(zh.creatorBenefits.progressHint, '成长值 {{current}} / {{target}}');
  assert.equal(en.creatorBenefits.growthValue, 'Growth');
  assert.equal(en.creatorBenefits.progressHint, 'Growth {{current}} / {{target}}');
});

test('创作者权益_作品行突出模式与标题并隐藏作品编号', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');

  assert.match(benefits, /className=\{styles\.workTitle\}/);
  assert.match(benefits, /className=\{styles\.modeTag\}/);
  assert.match(benefits, /className=\{styles\.statusTag\}/);
  assert.match(benefits, /className=\{styles\.workMetric\}/);
  assert.doesNotMatch(benefits, /· \{work\.fileId\}/);
  assert.match(benefitsCss, /\.workRow\s*\{[\s\S]*?grid-template-areas:[\s\S]*?"identity status"[\s\S]*?"identity metric"/);
  assert.match(benefitsCss, /\.modeTag\s*\{[\s\S]*?border-radius:\s*999px[\s\S]*?background:\s*rgba\(217, 60, 91,/);
});

test('创作者权益_作品模式标签与标题整体垂直居中并适当放大', () => {
  const benefits = read('src/page/CreatorBenefits.tsx');
  const benefitsCss = read('src/page/CreatorBenefits.module.css');

  assert.match(benefits, /className=\{styles\.workIdentity\}[\s\S]*?className=\{styles\.workTitle\}/);
  assert.match(benefitsCss, /grid-template-areas:[\s\S]*?"identity status"[\s\S]*?"identity metric"/);
  assert.match(benefitsCss, /\.workIdentity\s*\{[\s\S]*?align-self:\s*center/);
  assert.match(benefitsCss, /\.workTitle strong\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(benefitsCss, /\.modeTag\s*\{[\s\S]*?font-size:\s*12px/);
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

test('创作者权益_等级说明弹窗不显示底部补充小字', () => {
  const modal = read('src/components/CreatorBenefits/CreatorBenefitRulesModal.tsx');
  const modalCss = read('src/components/CreatorBenefits/CreatorBenefitRulesModal.module.css');

  assert.doesNotMatch(modal, /creatorBenefits\.guideSpecialNote|styles\.note/);
  assert.doesNotMatch(modalCss, /\.note/);
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
  assert.match(benefits, /className=\{styles\.dashboard\}/);
  assert.match(benefits, /className=\{`\$\{styles\.panel\}/);
  assert.doesNotMatch(benefits, /editorRatioHint|customRatioHint|freeCreationHint/);
  assert.match(benefitsCss, /\.panel\s*\{[\s\S]*?border-radius:\s*16px/);
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
