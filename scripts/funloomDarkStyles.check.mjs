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
  assert.match(detail, /styles\.pageTitle/);
  assert.match(detail, /styles\.coverTypeBadge/);
  assert.match(detail, /styles\.updateLogCard/);
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

test('Create_不再重复显示作品栏_作品栏样式保留给书架', () => {
  const tsx = read('src/page/Create.tsx');
  const panel = read('src/components/Create/CreatorWorksPanel.tsx');
  const css = read('src/page/Create.module.css');
  const zh = read('src/i18n/locales/zh.json');
  assert.doesNotMatch(tsx, /CreatorWorksPanel/);
  assert.match(panel, /create\.manage/);
  assert.doesNotMatch(panel, /create\.draftBox/);
  assert.doesNotMatch(panel, /draftFilterChip/);
  assert.doesNotMatch(tsx, /create\.images\.draftBox|create\.images\.myData|create\.images\.publishWorks/);
  assert.doesNotMatch(tsx, /分界线\.png|分界线移动端\.png/);
  assert.match(zh, /"draftBox":\s*"草稿箱"/);
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
  assert.match(bottomCss, /\.navItemActive[\s\S]*color:\s*#F16C83/);
  assert.match(bottomCss, /\.navItem[\s\S]*color:\s*#B8B8C2/);
  assert.doesNotMatch(bottomCss, /background:\s*#fff/);
  assert.doesNotMatch(bottomCss, /border-top:\s*1px solid #e6e6e6/);
  assert.doesNotMatch(bottomCss, /filter:\s*brightness\(0\)/);
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
  /* 功能注释：页脚全宽底部；壳宽居中；手机端仍显示但收成法律一行 */
  assert.match(css, /\.container\s*\{[\s\S]*?width:\s*min\(var\(--app-desktop-shell-max\)/);
  assert.match(css, /\.container\s*\{[\s\S]*?margin:\s*0\s+auto/);
  assert.match(css, /\.linkCols\s*\{/);
  const mobileFooter = css.slice(css.indexOf('@media screen and (max-width: 768px)'));
  assert.match(mobileFooter, /\.footer\s*\{[^}]*display:\s*flex/);
  assert.doesNotMatch(mobileFooter, /\.footer\s*\{[^}]*display:\s*none/);
  assert.match(mobileFooter, /\.linkCols[\s\S]*?display:\s*none/);
  assert.match(mobileFooter, /\.logo[\s\S]*?display:\s*none/);
  assert.match(css, /\.footer\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.footer\s*\{[\s\S]*?flex:\s*0\s+0\s+auto/);
  /* 功能注释：页脚文案须走 i18n，禁止硬编码中文 */
  assert.match(tsx, /useTranslation/);
  assert.match(tsx, /t\('footer\.tagline'\)/);
  assert.match(tsx, /t\('footer\.feedbackEntry'\)/);
  assert.doesNotMatch(tsx, /让每一个世界都可以被游玩/);
  assert.doesNotMatch(tsx, /意见反馈/);
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
  assert.match(css, /\.formSection\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(css, /\.formCard\s*\{[\s\S]*?gap:\s*10px/);
  /* 功能注释：效果图是返回+居中标题工具条，禁止再左对齐大标题+长副文把右侧留空 */
  /* 功能注释：右侧槽随「测试」带图标加宽，禁止再卡死 72px 挤图标 */
  assert.match(css, /\.pageHeader\s*\{[\s\S]*?grid-template-columns:\s*72px minmax\(0, 1fr\) minmax\(72px, auto\)/);
  assert.match(css, /\.btnLabel\s*\{/);
  assert.match(css, /\.btnIcon\s*\{/);
  assert.match(css, /\.pageTitle\s*\{[\s\S]*?text-align:\s*center/);
  /* 功能注释：图1未选为深底描边芯片，选中实心酒红；禁止再做成透明纯文字 */
  assert.match(css, /\.pageRoot\s+\.themeTagChip\s*\{[\s\S]*?background:\s*#1C1C1E/);
  assert.match(css, /\.pageRoot\s+\.themeTagChip\s*\{[\s\S]*?border:\s*1px solid/);
  assert.match(css, /\.pageRoot\s+\.themeTagChip\s*\{[\s\S]*?min-height:\s*38px/);
  assert.doesNotMatch(css, /\.pageRoot\s+\.themeTagChip\s*\{[^}]*min-height:\s*48px/);
  assert.doesNotMatch(css, /\.pageRoot\s+\.themeTagChip\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.pageRoot\s+\.themeTagChipActive\s*\{[\s\S]*?background:\s*#8E2135/);
  /* 功能注释：分段选中须带 :hover 实心酒红，避免触屏粘滞悬停盖成半透明 */
  assert.match(css, /\.pageRoot\s+\.segBtn\.segBtnActive:hover\s*\{[\s\S]*?background:\s*#8E2135/);
  assert.match(css, /\.themeTagsWrap\s*\{[\s\S]*?repeat\(6,/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.themeTagsWrap\s*\{[\s\S]*?repeat\(4,/);
  assert.match(tsx, /styles\.themeTagsHead/);
  assert.match(tsx, /styles\.requiredMark/);
  assert.match(css, /\.pageRoot \.clearPill\s*\{[\s\S]*?background:\s*#8E2135/);
  /* 功能注释：创建/测试双按钮通栏 14px 卡片，禁止细长胶囊 */
  assert.match(css, /\.pageRoot \.actions\s*\{[\s\S]*?flex-direction:\s*column/);
  const darkPrimary = css.match(/\.pageRoot \.primaryBtn,\s*\.pageRoot \.primaryBtnMeta\s*\{([^}]*)\}/)?.[1] ?? '';
  const darkSecondary = css.match(/\.pageRoot \.secondaryBtn\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(darkPrimary, /border-radius:\s*14px/);
  assert.match(darkPrimary, /width:\s*100%/);
  assert.doesNotMatch(darkPrimary, /border-radius:\s*999px/);
  assert.match(darkSecondary, /border-radius:\s*14px/);
  assert.match(darkSecondary, /width:\s*100%/);
  assert.match(css, /\.pageRoot \.textInput[\s\S]*?background:\s*var\(--custom-if-input\)/);
  assert.match(css, /\.richEditorDark/);
  assert.match(tsx, /styles\.formCard/);
  assert.match(tsx, /styles\.fieldBlock/);
  assert.match(tsx, /styles\.pageBack/);
  assert.match(tsx, /styles\.pageHeaderSlot/);
  assert.match(tsx, /customIFCreate\.headerTest/);
  assert.doesNotMatch(tsx, /styles\.pageSubtitle/);
  assert.match(tsx, /className=\{styles\.richEditorDark\}/);
  assert.match(tsx, /customIFCreate\.basicInfoTitle/);
  /* 功能注释：上传区去掉「上传内容」标题/说明/「上传」标签，从类型切换直接开始 */
  assert.doesNotMatch(tsx, /customIFCreate\.uploadSectionTitle/);
  assert.doesNotMatch(tsx, /customIFCreate\.uploadSectionDesc/);
  assert.doesNotMatch(tsx, /customIFCreate\.uploadLabel/);
  assert.match(tsx, /customIFCreate\.clearAll/);
  assert.doesNotMatch(tsx, /FooterArea/);
  assert.match(zh, /"basicInfoTitle":\s*"基础信息"/);
  assert.match(zh, /"headerTest":\s*"测试"/);
  assert.match(zh, /"backAria":\s*"返回创作中心"/);
  assert.match(zh, /"customIFCreate"[\s\S]*?"clearAll":\s*"一键清空"/);
});

test('Rankings_排行榜应对齐暗色酒红榜单卡', () => {
  const css = read('src/page/Rankings.module.css');
  const tsx = read('src/page/Rankings.tsx');
  /* 功能注释：暗色榜单区 + funloom 酒红强调，禁止再锁 1920 白边 */
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--rank-primary:\s*#A8283C/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?--rank-primary-deep:\s*#8E2135/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?max-width:\s*none/);
  assert.doesNotMatch(css, /\.pageRoot\s*\{[^}]*max-width:\s*1920px/);
  assert.match(css, /\.categoryBoxHeader\s*\{[\s\S]*?linear-gradient/);
  assert.match(css, /\.categoryBoxCover\s*\{[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.categoryBoxCover\s*\{[\s\S]*?width:\s*100%/);
  assert.match(tsx, /向右箭头\.svg/);
  assert.match(tsx, /categoryBoxMore/);
});

test('CreateGameModals_创作类型弹窗应对齐暗色卡片列表', () => {
  const css = read('src/components/CreateGame/CreateGameModals.module.css');
  /* 功能注释：类型列表已迁到 CreateType 页，样式仍复用 CreateGameModals.module.css */
  const tsx = read('src/page/CreateType.tsx');
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
  const tsx = read('src/page/CreateType.tsx');
  /* 功能注释：禁止空 thumb；含创作游戏（Romance）共六种模式各有图标 + 色调 class */
  assert.match(tsx, /icon=\{MdAutoStories\}/);
  assert.match(tsx, /icon=\{MdOutlineAutoAwesome\}/);
  assert.match(tsx, /icon=\{HiOutlineUserGroup\}/);
  assert.match(tsx, /icon=\{MdOutlineMovie\}/);
  assert.match(tsx, /icon=\{HiOutlinePuzzle\}/);
  assert.match(tsx, /icon=\{MdSportsEsports\}/);
  assert.match(tsx, /createTypeOptionIcon/);
  assert.match(css, /\.createTypeOptionThumbTxt/);
  assert.match(css, /\.createTypeOptionThumbRomance/);
  assert.match(css, /\.createTypeOptionThumbAvg/);
  assert.match(css, /\.createTypeOptionThumbIvg/);
  assert.match(css, /\.createTypeOptionThumbCustom/);
  assert.match(css, /\.createTypeOptionThumbRpg/);
  assert.match(css, /\.createTypeOptionThumb\s*\{[\s\S]*?display:\s*inline-flex/);
});

test('CreateGameModals_取消按钮应通栏卡片风格_禁止右下角胶囊', () => {
  const css = read('src/components/CreateGame/CreateGameModals.module.css');
  const cancel = css.match(/\.createTypeCancelButton\s*\{([^}]*)\}/)?.[1] ?? '';
  /* 功能注释：桌面/手机统一通栏 14px 圆角，禁止右下角透明胶囊 */
  assert.match(cancel, /width:\s*100%/);
  assert.match(cancel, /border-radius:\s*14px/);
  assert.doesNotMatch(cancel, /border-radius:\s*999px/);
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

test('StGameCreate_应对齐图1世界观设定暗色卡风格', () => {
  const css = read('src/page/StGameCreate.module.css');
  const tsx = read('src/page/StGameCreate.tsx');
  /* 功能注释：对齐图1——墨黑底 + #1A1A1A 面 + #1C1C1E 输入 + 酒红选中；禁止白纸卡 */
  assert.match(css, /--st-surface:\s*#1A1A1A/);
  assert.match(css, /--st-input:\s*#1C1C1E/);
  assert.match(css, /--st-accent-deep:\s*#8E2135/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?background:\s*var\(--st-ink\)|#000000/);
  assert.match(css, /\.pageRoot\s*\{[\s\S]*?max-width:\s*none/);
  assert.doesNotMatch(css, /max-width:\s*1920px/);
  assert.doesNotMatch(css, /#fb5b67|--st-paper:\s*#ffffff/);
  assert.match(css, /\.group\s*\{[\s\S]*?background:\s*var\(--st-surface\)/);
  assert.match(css, /\.themeTagsPanel\s*\{[\s\S]*?background:\s*var\(--st-surface\)/);
  assert.match(css, /\.text\s*\{[\s\S]*?background:\s*var\(--st-input\)/);
  assert.match(css, /\.themeTagsWrap\s*\{[\s\S]*?repeat\(6,/);
  assert.match(css, /\.themeTagChipActive\s*\{[\s\S]*?background:\s*var\(--st-accent-deep\)/);
  assert.match(css, /\.stepActive\s*\{[\s\S]*?background:\s*var\(--st-accent-deep\)/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.themeTagsWrap\s*\{[\s\S]*?repeat\(3,/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.actions \.primary[\s\S]*?width:\s*100%/);
  assert.match(
    css,
    /@media \(max-width:\s*768px\)[\s\S]*?\.stepOneArea\s*\{[\s\S]*?height:\s*calc\(1\.55em \* 9 \+ 24px\)/,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*768px\)[\s\S]*?\.stepOneArea\s*\{[\s\S]*?min-height:\s*180px/,
  );
  assert.match(tsx, /styles\.stepIndex/);
  assert.match(tsx, /styles\.stepLabel/);
  assert.match(css, /\.clearFieldButton\s*\{[\s\S]*?background:\s*var\(--st-accent-deep\)/);
  assert.match(css, /\.clearFieldButton:hover:not\(:disabled\)\s*\{[\s\S]*?background:\s*var\(--st-accent\)/);
  assert.match(css, /\.clearFieldButton\s*\{[^}]*color:\s*#ffffff/);
  assert.doesNotMatch(css, /\.clearFieldButton\s*\{[^}]*color:\s*var\(--st-muted\)/);
  /* 功能注释：题材未填不再 setError 插在「下一步」上方横幅，只 toast + 滚到标签 */
  assert.doesNotMatch(
    tsx,
    /themeTagsFieldRequired[\s\S]{0,80}setError\(message\)/,
  );
  assert.match(tsx, /guideToRequiredField\('themeTags'/);
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

test('UploadProgressModal_应对齐墨黑码头而非白底浮层', () => {
  const css = read('src/components/GameSettingEditor/DocumentUpload/UploadProgressModal.module.css');
  const tsx = read('src/components/GameSettingEditor/DocumentUpload/UploadProgressModal.tsx');
  const overlayCss = read('src/components/CreateGame/UploadProgress.module.css');
  /* 功能注释：进度码头必须吃 funloom 墨黑/酒红，禁止再出白卡片和亮粉关闭图 */
  assert.match(css, /--dock-surface:\s*#1A1A1A/);
  assert.match(css, /--dock-input:\s*#1C1C1E/);
  assert.match(css, /--dock-accent:\s*#8E2135/);
  assert.match(css, /--dock-accent-hot:\s*#A8283C/);
  assert.match(css, /\.modalContent\s*\{[\s\S]*?background:\s*var\(--dock-surface\)/);
  assert.match(css, /\.jobItem\s*\{[\s\S]*?background:\s*var\(--dock-input\)/);
  assert.match(css, /\.jobItem\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.progressContainer\s*\{[\s\S]*?align-items:\s*center/);
  assert.doesNotMatch(css, /@media \(max-width:\s*768px\)[\s\S]*?\.jobDetails\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(css, /@media \(max-width:\s*768px\)[\s\S]*?\.progressContainer\s*\{[\s\S]*?align-items:\s*flex-start/);
  assert.match(tsx, /styles\.jobDetails[\s\S]*styles\.etaText/);
  assert.doesNotMatch(css, /\.modalContent\s*\{[\s\S]*?background:\s*#fff/);
  assert.doesNotMatch(tsx, /关闭\.png|#FB4655/);
  assert.match(tsx, /formatEtaPrecise/);
  assert.match(overlayCss, /\.uploadOverlayContent\s*\{[^}]*background:\s*var\(--dock-surface\)/);
  assert.doesNotMatch(overlayCss, /\.uploadOverlayContent\s*\{[^}]*background:\s*rgba\(255/);
});

test('AssetGapBanner_生成进度应走墨黑竖脊而非糖纸色块', () => {
  const css = read('src/components/GameSettingEditor/AssetGapBanner.module.css');
  const tsx = read('src/components/GameSettingEditor/AssetGapBanner.tsx');
  /* 功能注释：禁止浅绿完成卡 / 浅红进行卡 / 手机双列折行；当前步只留酒红左边轨 */
  assert.match(css, /--gap-surface:\s*#1A1A1A/);
  assert.match(css, /--gap-input:\s*#1C1C1E/);
  assert.match(css, /--gap-accent:\s*#8E2135/);
  assert.match(css, /\.banner\s*\{[\s\S]*?background:\s*var\(--gap-surface\)/);
  assert.match(css, /\.banner\s*\{[\s\S]*?margin:\s*0;/);
  assert.doesNotMatch(css, /\.banner\s*\{[\s\S]*?margin:\s*0 0 16px/);
  assert.match(css, /\.steps\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.stepActive\s*\{[\s\S]*?inset 3px 0 0 var\(--gap-accent\)/);
  assert.doesNotMatch(css, /#2ea05a|#1a1a1a|rgba\(255,\s*247,\s*248/);
  assert.doesNotMatch(css, /grid-template-columns:\s*1fr 1fr/);
  assert.match(tsx, /styles\.stepCopy/);
  assert.match(tsx, /createGame\.assetProgressStepPortraits/);
});
