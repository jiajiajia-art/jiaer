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
  assert.doesNotMatch(indexCss, /body\s*\{[^}]*background:\s*#000/);
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
  assert.match(detail, /nav_back\.webp/);
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
  assert.match(css, /aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(css, /\.goodsTitle[\s\S]*color:\s*#FFFFFF/);
  assert.match(css, /\.goodsCard[\s\S]*border-radius:\s*16px/);
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
  const bottomCss = read('src/components/Layout/MobileBottomNav.module.css');
  assert.match(navbarCss, /@media \(max-width:\s*768px\)[\s\S]*--navbar-surface:\s*#000000/);
  assert.doesNotMatch(navbarCss, /@media \(max-width:\s*768px\)[\s\S]*--navbar-surface:\s*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255/);
  assert.match(bottomCss, /\.container[\s\S]*background:\s*#000000/);
  assert.match(bottomCss, /\.navItemActive[\s\S]*color:\s*#A8283C/);
  assert.doesNotMatch(bottomCss, /background:\s*#fff/);
  assert.doesNotMatch(bottomCss, /border-top:\s*1px solid #e6e6e6/);
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
