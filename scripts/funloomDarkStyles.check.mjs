/**
 * 暗色 funloom 移动端样式回归：关键页面令牌与图标接线。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const assetsHome = join(root, 'public/data/assetsv2/home');

test('Home_pageRoot_应使用黑色背景与酒红强调色令牌', () => {
  const css = read('src/page/Home.module.css');
  assert.match(css, /background:\s*#000000/);
  assert.match(css, /--primary:\s*#A8283C/);
  /* 功能注释：PC 全宽铺黑，禁止再卡 1920 露出 body 白边 */
  assert.match(css, /\.pageRoot\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.pageRoot\s*\{[^}]*width:\s*100%/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*max-width:\s*1920px/);
  assert.match(css, /\.themeShowcaseItemActive[\s\S]*background:\s*#8E2135/);
  assert.match(css, /\.homeTicker[\s\S]*background:\s*#1A1A1A/);
  assert.match(css, /\.homeTickerBadge/);
  assert.match(css, /\.themeShowcaseItem[\s\S]*min-height:\s*40px/);
  assert.match(css, /\.mobileJoinGroupCard[\s\S]*background:\s*#1C1C1E/);
  assert.match(css, /\.mobileJoinGroupCard\s*\{[^}]*border-radius:\s*18px/);
  assert.doesNotMatch(css, /\.mobileJoinGroupCard\s*\{[^}]*border-radius:\s*999px/);
  assert.match(css, /\.mobileJoinGroupAction[\s\S]*linear-gradient/);
  assert.doesNotMatch(css, /\.mobileJoinGroupCard[\s\S]*background:\s*#ffffff/);
  assert.doesNotMatch(css, /\.carouselImage\s*\{[^}]*background:\s*#f5f5f5/);
});

test('Home_加群横幅应使用下载切图icon_community且文案对齐效果图', () => {
  const tsx = read('src/page/Home.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(tsx, /icon_community\.svg/);
  assert.doesNotMatch(tsx, /JoinGroupPeopleIcon/);
  assert.doesNotMatch(tsx, /viewBox="0 0 1024 1024"/);
  assert.ok(existsSync(join(root, 'public/data/assetsv2/home/icon_community.svg')));
  assert.match(zh, /"title":\s*"官方精选交流群"/);
  assert.match(zh, /"desc":\s*"一起讨论剧情，分享心得"/);
  assert.match(zh, /"joinNow":\s*"立即加入"/);
});

test('Messages_Promotion_Categories_Create_GameDetail_应本地暗色且不依赖全局body黑', () => {
  for (const file of [
    'src/page/Messages.module.css',
    'src/page/PromotionCenter.module.css',
    'src/page/Categories.module.css',
    'src/page/Create.module.css',
    'src/page/GameDetail.module.css',
  ]) {
    const css = read(file);
    assert.match(css, /#000000|#1A1A1A|#1C1C1E|#1E1E1E/, `${file} missing dark surface`);
    assert.match(css, /#8E2135|#A8283C/, `${file} missing burgundy accent`);
  }
  const indexCss = read('src/index.css');
  assert.match(indexCss, /body\s*\{[^}]*background:\s*#000000/);
  assert.match(indexCss, /#root\s*\{[\s\S]*?background:\s*#000000/);
  const navbarCss = read('src/components/Layout/Navbar.module.css');
  assert.match(navbarCss, /\.navbarContainer\s*\{[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(navbarCss, /\.navbarContainer\s*\{[^}]*max-width:\s*1920px/);
  for (const file of [
    'src/page/Categories.module.css',
    'src/page/Create.module.css',
    'src/page/GameDetail.module.css',
  ]) {
    const css = read(file);
    assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*max-width:\s*1920px|\.pageContainer\s*\{[^}]*max-width:\s*1920px/, `${file} still capped at 1920`);
  }
});

test('Navbar_GameDetail_GameGrid_应接线assetsv2_home图标', () => {
  const navbar = read('src/components/Layout/Navbar.tsx');
  const detail = read('src/page/GameDetail.tsx');
  const grid = read('src/components/GameGrid.tsx');
  const promo = read('src/page/PromotionCenter.tsx');
  const messages = read('src/page/Messages.tsx');
  assert.match(navbar, /assetsv2\/home/);
  assert.match(navbar, /nav_search\.webp/);
  assert.match(navbar, /nav_message\.webp/);
  assert.match(navbar, /nav_btn_bg\.webp/);
  assert.doesNotMatch(navbar, /IoSearch|IoMailOutline/);
  const navbarCss = read('src/components/Layout/Navbar.module.css');
  /* 顶栏搜索/消息图标按效果图为 14px；圆形按钮用 nav_btn_bg */
  assert.match(navbarCss, /\.searchIcon img,\s*\n\s*\.messageButton img\s*\{[^}]*width:\s*14px/);
  assert.match(navbarCss, /\.navAssetIcon\s*\{[^}]*width:\s*14px/);
  assert.match(navbarCss, /--navbar-btn-circle-bg/);
  assert.match(navbarCss, /\.messageButton\s*\{[^}]*background-image:\s*var\(--navbar-btn-circle-bg\)/);
  assert.doesNotMatch(navbarCss, /\.searchIcon\s*\{[^}]*background-image:\s*var\(--navbar-btn-circle-bg\)/);
  assert.match(navbarCss, /\.searchIcon\s*\{[^}]*background:\s*var\(--navbar-search-icon-bg\)/);
  assert.doesNotMatch(navbarCss, /\.searchIcon img,\s*\n\s*\.messageButton img\s*\{[^}]*width:\s*28px/);
  assert.match(detail, /assetsv2\/home/);
  assert.doesNotMatch(detail, /nav_back\.webp/);
  assert.match(detail, /M15 6L9 12L15 18/);
  assert.match(detail, /DetailShareIcon|GameDetailStatIcons/);
  assert.match(detail, /DetailHeartIcon/);
  assert.match(detail, /DetailStarIcon/);
  assert.match(detail, /icon_gamepad\.webp/);
  assert.match(detail, /icon_filmstrip\.webp/);
  assert.match(detail, /styles\.statsBar/);
  assert.match(detail, /styles\.statsIconWrap/);
  assert.match(detail, /gameDetail\.storyReplay/);
  assert.doesNotMatch(detail, /FaRegShareFromSquare|IoChevronBack|AiOutlineStar|AiFillStar/);
  assert.doesNotMatch(detail, /statsBar[\s\S]{0,800}icon_share\.(svg|webp)/);
  assert.match(grid, /CardFlameIcon/);
  assert.match(grid, /CardHeartIcon/);
  assert.doesNotMatch(grid, /icon_flame\.webp|icon_heart\.svg/);
  assert.doesNotMatch(grid, /icon_download\.webp|AiOutlineLike|IoGameControllerOutline|RiMoneyCnyCircleLine/);
  const icons = read('src/components/GameCardStatIcons.tsx');
  assert.match(icons, /icon_flame_pink\.webp/);
  assert.match(icons, /icon_heart\.webp/);
  assert.match(icons, /maskImage|WebkitMaskImage/);
  assert.match(promo, /icon_hot\.webp/);
  assert.match(promo, /icon_my_submissions\.webp/);
  assert.match(messages, /icon_mark_all_read\.webp/);
});

test('GameGrid_封面应为竖版圆角且标题白色', () => {
  const css = read('src/components/GameGrid.module.css');
  const grid = read('src/components/GameGrid.tsx');
  assert.match(css, /aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(css, /\.goodsTitle[\s\S]*color:\s*#FFFFFF/);
  assert.match(css, /\.goodsCard[\s\S]*border-radius:\s*16px/);
  assert.match(css, /\.goodsImgPlaceholder/);
  assert.match(grid, /goodsImgPlaceholder/);
  assert.doesNotMatch(grid, /welcome\.png/);
});

test('Create_草稿区应对齐新版文字标题与暗色筛选条', () => {
  const tsx = read('src/page/Create.tsx');
  const css = read('src/page/Create.module.css');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(tsx, /styles\.sectionHeading/);
  assert.match(tsx, /styles\.sectionRule/);
  assert.match(tsx, /styles\.draftFilterBar/);
  assert.match(tsx, /create\.draftBox/);
  assert.match(tsx, /create\.myData/);
  assert.doesNotMatch(tsx, /create\.images\.draftBox|create\.images\.myData|create\.images\.publishWorks/);
  assert.doesNotMatch(tsx, /分界线\.png|分界线移动端\.png/);
  assert.match(css, /\.sectionHeading\s*\{/);
  assert.match(css, /\.draftFilterBar\s*\{[^}]*background:\s*#1A1A1A/);
  assert.match(css, /\.draftFilterChipActive\s*\{[^}]*background:\s*#8E2135/);
  assert.match(zh, /"draftBox":\s*"草稿"/);
  assert.match(zh, /"myData":\s*"我的数据"/);
});

test('GameGrid_角标应使用下载白火焰白心且禁止download切图', () => {
  const grid = read('src/components/GameGrid.tsx');
  const icons = read('src/components/GameCardStatIcons.tsx');
  const css = read('src/components/GameGrid.module.css');
  assert.match(grid, /CardFlameIcon/);
  assert.match(grid, /CardHeartIcon/);
  assert.match(icons, /icon_flame_pink\.webp/);
  assert.match(icons, /icon_heart\.webp/);
  assert.match(css, /\.goodsInfoHeart[\s\S]*width:\s*16\.8px/);
  assert.match(css, /\.goodsInfoFlame[\s\S]*width:\s*15\.12px/);
  assert.match(css, /\.goodsInfoItem[\s\S]*font-size:\s*13\.2px/);
  assert.ok(existsSync(join(assetsHome, 'icon_flame_pink.webp')));
  assert.ok(existsSync(join(assetsHome, 'icon_heart.webp')));
  assert.doesNotMatch(grid, /icon_download\.webp/);
});

test('Navbar_MobileBottomNav_移动端应为暗色funloom壳', () => {
  const navbarCss = read('src/components/Layout/Navbar.module.css');
  const navbarTsx = read('src/components/Layout/Navbar.tsx');
  const bottomCss = read('src/components/Layout/MobileBottomNav.module.css');
  assert.match(navbarCss, /@media \(max-width:\s*768px\)[\s\S]*--navbar-surface:\s*#000000/);
  assert.doesNotMatch(navbarCss, /@media \(max-width:\s*768px\)[\s\S]*--navbar-surface:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255/);
  assert.match(bottomCss, /\.container[\s\S]*background:\s*#000000/);
  assert.match(bottomCss, /\.navItemActive[\s\S]*color:\s*#A8283C/);
  assert.doesNotMatch(bottomCss, /background:\s*#fff/);
  assert.doesNotMatch(bottomCss, /border-top:\s*1px solid #e6e6e6/);
  /* 功能注释：顶栏 Logo 点击须回首页 */
  assert.match(navbarTsx, /className=\{styles\.logo\}[\s\S]*?navigate\('\/home'\)/);
  assert.match(navbarCss, /\.logo\s*\{[\s\S]*?cursor:\s*pointer/);
});

test('Home_加载更多骨架禁止额外水平padding以免与列表错位', () => {
  const tsx = read('src/page/Home.tsx');
  const css = read('src/page/Home.module.css');
  assert.match(tsx, /styles\.loadMoreSkeleton/);
  assert.doesNotMatch(tsx, /padding:\s*['"]20px['"][\s\S]{0,80}GameGridSkeleton/);
  assert.doesNotMatch(tsx, /GameGridSkeleton[\s\S]{0,120}padding:\s*['"]20px['"]/);
  assert.match(css, /\.loadMoreSkeleton[\s\S]*padding:\s*0/);
});

test('Home_移动端列表左右边距应与筛选条对齐为12px', () => {
  const css = read('src/page/Home.module.css');
  assert.match(css, /\.mobileJoinGroupSection[\s\S]*width:\s*calc\(100%\s*-\s*24px\)/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*\.shopSection[\s\S]*padding:\s*0 12px/);
  assert.doesNotMatch(css, /@media \(max-width:\s*768px\)[\s\S]*\.shopSection[\s\S]*padding:\s*0 20px/);
  assert.match(css, /--home-filter-gap-above:\s*16px/);
  assert.match(css, /--home-filter-gap-below:\s*calc\(var\(--home-filter-gap-above\)\s*\/\s*2\)/);
  assert.match(css, /\.shopSection[\s\S]*margin-top:\s*var\(--home-filter-gap-below/);
  const filterCss = read('src/components/HomeGameFilterBar.module.css');
  assert.match(filterCss, /\.bar[\s\S]*margin-top:\s*var\(--home-filter-gap-above/);
});

test('GameGridSkeleton_应为暗色funloom骨架且竖版封面', () => {
  const css = read('src/components/Skeleton/GameGridSkeleton.module.css');
  assert.match(css, /\.skeletonCard[\s\S]*background:\s*#1C1C1E/);
  assert.match(css, /\.coverSkeleton[\s\S]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(css, /\.coverSkeleton[\s\S]*#141414/);
  assert.match(css, /\.titleSkeleton[\s\S]*#2A2A2C/);
  assert.match(css, /\.priceSkeleton[\s\S]*#A8283C|#8E2135|#6E1A2A/);
  assert.doesNotMatch(css, /\.skeletonCard[\s\S]*background:\s*#fff/);
  assert.doesNotMatch(css, /#ededed|#f5f5f5|#f7b1b8/);
});

test('assetsv2_home_应包含效果图关键webp图标', () => {
  assert.ok(existsSync(assetsHome), 'assetsv2/home missing');
  const files = new Set(readdirSync(assetsHome).filter((f) => f.endsWith('.webp') || f.endsWith('.svg')));
  for (const name of [
    'nav_menu.webp',
    'nav_search.webp',
    'nav_message.webp',
    'nav_message.svg',
    'nav_btn_bg.webp',
    'nav_back.webp',
    'icon_share.webp',
    'icon_share.svg',
    'icon_heart.webp',
    'icon_heart.svg',
    'icon_flame.webp',
    'icon_star.webp',
    'icon_star.svg',
    'icon_gamepad.webp',
    'icon_eye.webp',
    'icon_download.webp',
    'icon_community.webp',
    'icon_hot.webp',
    'icon_filmstrip.webp',
    'icon_edit.webp',
    'stats_play.webp',
    'stats_view.webp',
    'stats_income.webp',
    'stats_share.webp',
  ]) {
    assert.ok(files.has(name) || existsSync(join(assetsHome, name)), `missing ${name}`);
  }
  const webps = readdirSync(assetsHome).filter((f) => f.endsWith('.webp'));
  assert.ok(webps.length >= 40, `expected curated webp icons, got ${webps.length}`);
  const msgSvg = readFileSync(join(assetsHome, 'nav_message.svg'), 'utf8');
  assert.match(msgSvg, /rect[^>]+rx=/);
  assert.match(msgSvg, /M7\.6 8 H16\.4/);
  assert.doesNotMatch(msgSvg, /ellipsis|three dots/i);
});

test('Categories_应对齐效果图_卡外标题与左标签右chips换行', () => {
  const css = read('src/page/Categories.module.css');
  const tsx = read('src/page/Categories.tsx');
  assert.match(css, /\.pageRoot\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.pageHeader\s*\{/);
  assert.match(css, /\.filterSection\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.match(css, /\.chipRow[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /\.chipRowSingle\s*\{[\s\S]*?flex-wrap:\s*nowrap/);
  assert.match(css, /\.themeScrollRow[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(css, /\.filtersCard\s*\{[\s\S]*?background:\s*#0A0A0A/);
  assert.doesNotMatch(css, /\.filtersCard\s*\{[\s\S]*?background:\s*#1A1A1A/);
  assert.match(css, /\.filtersCard\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(tsx, /singleLine:\s*true/);
  assert.match(tsx, /<Navbar\s*\/>/);
  assert.match(tsx, /resolveCategoriesPageTitleKey/);
  assert.match(tsx, /styles\.pageHeader/);
  assert.doesNotMatch(tsx, /filtersCardHead/);
  assert.doesNotMatch(tsx, /useHorizontalChipScroll/);
});

test('FooterArea_应对齐全站暗色壳避免底部白条', () => {
  const css = read('src/components/Layout/FooterArea.module.css');
  const tsx = read('src/components/Layout/FooterArea.tsx');
  const navbar = read('src/components/Layout/Navbar.tsx');
  assert.match(css, /\.footer\s*\{[\s\S]*?background-color:\s*var\(--footer-surface\)|#0A0A0A|#000000/);
  assert.match(css, /--footer-surface:\s*#0A0A0A/);
  assert.match(css, /\.title\s*\{[\s\S]*?color:\s*var\(--footer-title\)/);
  assert.doesNotMatch(css, /background-color:\s*#f7f7f7/);
  assert.doesNotMatch(css, /\.title\s*\{[^}]*color:\s*#4c4c4c/);
  // 功能注释：页脚与顶栏共用白字 LOGO2，避免暗底上 LOGO.png 黑字不可见
  assert.match(tsx, /LOGO2\.png/);
  assert.doesNotMatch(tsx, /LOGO\.png/);
  assert.match(navbar, /LOGO2\.png/);
});

test('CustomIFCreate_编辑页应对齐世界观暗色卡表单', () => {
  const css = read('src/page/CustomIFCreate.module.css');
  const tsx = read('src/page/CustomIFCreate.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(css, /\.pageRoot\s*\{[^}]*background:\s*#000000/);
  assert.match(css, /\.pageRoot\s*\{[^}]*max-width:\s*none/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*max-width:\s*1920px/);
  /* 功能注释：编辑页主栏宽度对齐创作页壳宽，禁止再卡 720 */
  assert.match(css, /\.mainContent\s*\{[\s\S]*?width:\s*min\(var\(--app-desktop-shell-max\)/);
  assert.doesNotMatch(css, /\.mainContent\s*\{[^}]*width:\s*min\(720px/);
  assert.match(css, /--primary-dark:\s*#8E2135|--primary:\s*#A8283C/);
  assert.match(css, /\.formCard\s*\{[\s\S]*?background:\s*var\(--custom-if-surface\)/);
  assert.match(css, /\.pageRoot\s+\.themeTagChipActive\s*\{[\s\S]*?background:\s*#8E2135/);
  assert.match(css, /\.pageRoot\s+\.textInput[\s\S]*?background:\s*var\(--custom-if-input\)/);
  assert.match(css, /\.richEditorDark/);
  assert.match(tsx, /styles\.formCard/);
  assert.match(tsx, /styles\.fieldBlock/);
  assert.match(tsx, /styles\.pageSubtitle/);
  assert.match(tsx, /className=\{styles\.richEditorDark\}/);
  assert.match(tsx, /customIFCreate\.basicInfoTitle/);
  assert.match(tsx, /customIFCreate\.uploadSectionTitle/);
  assert.doesNotMatch(tsx, /FooterArea/);
  assert.match(zh, /"basicInfoTitle":\s*"基础信息"/);
  assert.match(zh, /"pageSubtitle":/);
});

test('Rankings_排行榜应对齐奶油台面与酒红榜单卡', () => {
  const css = read('src/page/Rankings.module.css');
  const tsx = read('src/page/Rankings.tsx');
  /* 功能注释：效果图为浅色榜单区 + funloom 酒红强调，禁止再锁 1920 白边 */
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--rank-primary:\s*#A8283C/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--rank-primary-deep:\s*#8E2135/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?max-width:\s*none/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*max-width:\s*1920px/);
  assert.match(css, /\.categoryBoxHeader\s*\{[\s\S]*?linear-gradient/);
  assert.match(css, /\.categoryBoxMore\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.categoryBoxRank\[data-rank="1"\][\s\S]*?color:\s*var\(--rank-primary\)/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.categoryBoxCover\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.categoryBoxCover\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(tsx, /moreSpark/);
  assert.match(tsx, /fill="currentColor"/);
  assert.doesNotMatch(tsx, /fill="#c94a3a;"/);
});

test('CreateGameModals_创作类型弹窗应对齐暗色卡片列表', () => {
  const css = read('src/components/CreateGame/CreateGameModals.module.css');
  const tsx = read('src/components/CreateGame/CreateGameModals.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(css, /\.createTypeModal\s*\{[\s\S]*?--type-primary:\s*#A8283C/);
  assert.match(css, /\.createTypeModal\s*\{[\s\S]*?background-color:\s*var\(--type-surface\)/);
  assert.match(css, /\.createTypeOption\s*\{[\s\S]*?background-color:\s*var\(--type-card\)/);
  assert.match(css, /\.createTypeOptionThumb/);
  assert.match(css, /\.createTypeOptionChevron/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\.createTypeOptionThumb\s*\{[\s\S]*?aspect-ratio:\s*1/);
  assert.doesNotMatch(css, /\.createTypeModal\s*\{[^}]*background-color:\s*#ffffff/);
  assert.match(tsx, /TypeOptionRow/);
  assert.match(tsx, /createTypeOptionThumb/);
  assert.match(tsx, /IoChevronForward/);
  assert.match(zh, /"selectGameTypeTitle":\s*"创建游戏类型"/);
  assert.match(zh, /"optionHint":\s*"多种创作模式，开启你的灵感"/);
});

test('CreateGameModals_类型行应有区分色调的模式图标', () => {
  const css = read('src/components/CreateGame/CreateGameModals.module.css');
  const tsx = read('src/components/CreateGame/CreateGameModals.tsx');
  /* 功能注释：禁止空 thumb；五种模式各有图标 + 色调 class */
  assert.match(tsx, /icon=\{MdAutoStories\}/);
  assert.match(tsx, /icon=\{HiOutlineUserGroup\}/);
  assert.match(tsx, /icon=\{MdOutlineMovie\}/);
  assert.match(tsx, /icon=\{HiOutlinePuzzle\}/);
  assert.match(tsx, /icon=\{MdSportsEsports\}/);
  assert.match(tsx, /tone="txt"/);
  assert.match(tsx, /createTypeOptionIcon/);
  assert.match(css, /\.createTypeOptionThumbTxt/);
  assert.match(css, /\.createTypeOptionThumbAvg/);
  assert.match(css, /\.createTypeOptionThumbIvg/);
  assert.match(css, /\.createTypeOptionThumbCustom/);
  assert.match(css, /\.createTypeOptionThumbRpg/);
  assert.match(css, /\.createTypeOptionThumb\s*\{[\s\S]*?display:\s*inline-flex/);
});

test('CreateGameModals_手机取消按钮应满宽', () => {
  const css = read('src/components/CreateGame/CreateGameModals.module.css');
  /* 功能注释：≤640px 取消键 width:100%，禁止继续右下角小胶囊 */
  assert.match(
    css,
    /@media \(max-width:\s*640px\)[\s\S]*?\.createTypeCancelButton\s*\{[\s\S]*?width:\s*100%/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*640px\)[\s\S]*?\.createTypeCancelButton\s*\{[\s\S]*?min-height:\s*48px/,
  );
});

test('Create_创作主按钮应铺满资产卡整行避免与积分卡齐边', () => {
  const css = read('src/page/Create.module.css');
  /* 功能注释：主 CTA flex:1 + 帮助按钮贴右，禁止再写死 70%/80% 宽导致只与左卡上下对齐 */
  assert.match(css, /\.creatorPrimaryButton\s*\{[\s\S]*?flex:\s*1 1 auto/);
  assert.doesNotMatch(css, /\.creatorPrimaryButton\s*\{[^}]*width:\s*70%/);
  assert.doesNotMatch(css, /@media \(max-width:\s*1080px\)[\s\S]*?\.creatorPrimaryButton\s*\{[^}]*width:\s*80%/);
  assert.match(css, /@media \(max-width:\s*1080px\)[\s\S]*?\.creatorHeroActions\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /@media \(max-width:\s*1080px\)[\s\S]*?\.creatorHeroActions\s*\{[\s\S]*?justify-content:\s*flex-start/);
});

test('Create_手机我的数据应三列且数字缩小', () => {
  const css = read('src/page/Create.module.css');
  /* 功能注释：≤1080 我的数据一行三格；数字 18px，禁止再写 26px */
  assert.match(
    css,
    /@media \(max-width:\s*1080px\)[\s\S]*?\.statsGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*1080px\)[\s\S]*?\.statValue\s*\{[\s\S]*?font-size:\s*18px/,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*1080px\)[\s\S]*?\.statValue\s*\{[^}]*font-size:\s*26px/,
  );
});

test('StGameCreate_应对齐墨黑底白纸卡片新版风格', () => {
  const css = read('src/page/StGameCreate.module.css');
  const tsx = read('src/page/StGameCreate.tsx');
  /* 功能注释：禁止浅灰页 + #fb5b67；墨黑底、白纸卡、酒红强调、步号缩小、手机三列标签 */
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?background:\s*var\(--st-ink\)|#000000/);
  assert.match(css, /--st-accent-deep:\s*#8E2135/);
  assert.match(css, /--st-paper:\s*#ffffff/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?max-width:\s*none/);
  assert.doesNotMatch(css, /max-width:\s*1920px/);
  assert.doesNotMatch(css, /#fb5b67/);
  assert.match(css, /\.stepActive\s*\{[\s\S]*?background:\s*#ffffff/);
  assert.match(css, /\.step\s*\{[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255/);
  assert.match(css, /\.themeTagsPanel\s*\{[\s\S]*?background:\s*var\(--st-paper\)/);
  assert.match(css, /\.group\s*\{[\s\S]*?background:\s*var\(--st-paper\)/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.themeTagsWrap\s*\{[\s\S]*?repeat\(3,/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.actions \.primary[\s\S]*?width:\s*100%/);
  assert.match(tsx, /styles\.stepIndex/);
  assert.match(tsx, /styles\.stepLabel/);
});

test('Document_文档中心应对齐白顶栏加墨黑阅读区', () => {
  const css = read('src/page/Document.module.css');
  const tsx = read('src/page/Document.tsx');
  /* 功能注释：效果图保留白顶栏；正文/侧栏走 funloom 墨黑与酒红轨 */
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--doc-bg:\s*#000000/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--brand-red:\s*#A8283C/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--brand-red-deep:\s*#8E2135/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?background:\s*var\(--doc-bg\)/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?max-width:\s*none/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*max-width:\s*1920px/);
  assert.match(css, /\.topNav\s*\{[\s\S]*?background:\s*#ffffff/);
  assert.match(css, /\.templateDownloadButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.markdownBody\s*\{[\s\S]*?color:\s*rgba\(255,\s*255,\s*255/);
  assert.match(css, /\.markdownBody h2\s*\{[\s\S]*?border-left:\s*4px solid var\(--brand-red\)/);
  assert.match(css, /\.copyButton\s*\{[\s\S]*?background:\s*#ffffff/);
  assert.match(css, /\.sidebar\s*\{[\s\S]*?background:\s*var\(--doc-bg\)/);
  assert.match(css, /\.contentPanel\s*\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(css, /\.title\s*\{[^}]*color:\s*#0f0f0f/);
  assert.match(tsx, /复制 MARKDOWN/);
  assert.match(tsx, /funloom_icon\.png/);
  assert.match(tsx, /mobileMenuButton/);
  assert.match(tsx, /模板下载/);
  /* 功能注释：顶栏不再放 guide tabs / 返回键，避免与效果图冲突 */
  assert.doesNotMatch(tsx, /topNavCenter/);
  assert.doesNotMatch(tsx, /topNavBackButton/);
  /* 功能注释：手机文档配图须去掉固定宽高并由 CSS 等比缩进版心 */
  assert.match(tsx, /imgElement\.removeAttribute\('width'\)/);
  assert.match(tsx, /imgElement\.removeAttribute\('height'\)/);
  assert.match(css, /\.markdownBody img\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(css, /\.markdownBody img\s*\{[\s\S]*?height:\s*auto/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.markdownBody img\s*\{[\s\S]*?width:\s*100%/);
});
