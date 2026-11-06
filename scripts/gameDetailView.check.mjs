/**
 * 作品详情页展示辅助与效果图布局接线回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGameDetailMetaLine,
  descriptionNeedsExpand,
  formatCreatorOverviewCount,
  formatDetailStatCount,
  resolveGameDetailTags,
} from '../src/lib/gameDetailView.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('formatDetailStatCount_应输出整数与k量级', () => {
  assert.equal(formatDetailStatCount(0), '0');
  assert.equal(formatDetailStatCount(892), '892');
  assert.equal(formatDetailStatCount(8500), '8.5k');
  assert.equal(formatDetailStatCount(12000), '12k');
});

test('formatCreatorOverviewCount_应按万缩写对齐效果图', () => {
  assert.equal(formatCreatorOverviewCount(0), '0');
  assert.equal(formatCreatorOverviewCount(345), '345');
  assert.equal(formatCreatorOverviewCount(1506000), '150.6w');
  assert.equal(formatCreatorOverviewCount(34560), '3.5w');
});

test('GameStatsView_应对齐暗色效果图结构', () => {
  const tsx = read('src/components/CreateGame/GameStatsView.tsx');
  const css = read('src/components/CreateGame/GameStatsView.module.css');
  assert.match(tsx, /createGame\.startPlaying/);
  assert.match(tsx, /createGame\.dataOverview/);
  assert.match(tsx, /styles\.overviewCard/);
  assert.match(tsx, /styles\.primaryStartBtn/);
  assert.match(tsx, /styles\.secondaryActions/);
  assert.match(tsx, /formatCreatorOverviewCount/);
  assert.match(tsx, /resolveGameDetailTags/);
  /* 功能注释：自己的作品页禁止把 author_name 传给制作方文案 */
  assert.match(tsx, /buildGameDetailMetaLine\([\s\S]*?title:\s*gameDetail\.title/);
  assert.doesNotMatch(tsx, /buildGameDetailMetaLine\(\s*gameDetail\s*,/);
  assert.doesNotMatch(tsx, /create\.images\.myData|分界线\.png|开始按钮\.png/);
  assert.match(css, /\.statsModeWrapper\s*\{[^}]*background:\s*#000000/);
  assert.match(css, /\.primaryStartBtn\s*\{[^}]*background:\s*#8E2135/);
  assert.match(css, /\.overviewCard\s*\{[^}]*background:\s*#1A1A1A/);
});

test('GameStatsView_手机全部数据应一行三格且数字缩小', () => {
  const css = read('src/components/CreateGame/GameStatsView.module.css');
  /* 功能注释：禁止 ≤768 再写成 1fr 通栏；数字从 22px 降到 16px */
  assert.match(
    css,
    /@media \(max-width:\s*768px\)[\s\S]*?\.statsGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    css,
    /@media \(max-width:\s*768px\)[\s\S]*?\.statValue\s*\{[\s\S]*?font-size:\s*16px/,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*768px\)[\s\S]*?\.statsGrid\s*\{[^}]*grid-template-columns:\s*1fr/,
  );
});

test('buildGameDetailMetaLine_应拼接制作方与可选章节时长', () => {
  const line = buildGameDetailMetaLine(
    { author_name: 'Studio Red', chapter_count: 12, duration_minutes: 45 },
    {
      producedBy: (author) => `由${author} 制作`,
      chapterUnit: '章',
      minuteUnit: '分钟',
    },
  );
  assert.equal(line, '由Studio Red 制作 · 12章 · 45分钟');
});

test('buildGameDetailMetaLine_无作者时不伪造制作方', () => {
  const line = buildGameDetailMetaLine(
    { subtitle: '短篇互动' },
    {
      producedBy: (author) => `由${author} 制作`,
      chapterUnit: '章',
      minuteUnit: '分钟',
    },
  );
  assert.equal(line, '短篇互动');
});

test('buildGameDetailMetaLine_副标题与标题相同时不拼接', () => {
  const line = buildGameDetailMetaLine(
    {
      author_name: '鸟枪换炮',
      title: '霍去病封狼居胥模拟器',
      subtitle: '霍去病封狼居胥模拟器',
    },
    {
      producedBy: (author) => `由${author} 制作`,
      chapterUnit: '章',
      minuteUnit: '分钟',
    },
  );
  assert.equal(line, '由鸟枪换炮 制作');
  assert.doesNotMatch(line, /霍去病封狼居胥模拟器/);
});

test('resolveGameDetailTags_最多三个题材', () => {
  assert.deepEqual(
    resolveGameDetailTags({ theme_tag_names: ['科幻', '悬疑', '互动', '全部', '多余'] }),
    ['科幻', '悬疑', '互动'],
  );
});

test('resolveGameDetailTags_TXT引擎码应展示为AI文游', () => {
  assert.deepEqual(resolveGameDetailTags({ game_tags: 'TXT' }), ['AI文游']);
  assert.deepEqual(resolveGameDetailTags({ engine: 'TXT' }), ['AI文游']);
  assert.doesNotMatch(resolveGameDetailTags({ game_tags: 'TXT' }).join(','), /TXT/);
});

test('descriptionNeedsExpand_长文才需要阅读更多', () => {
  assert.equal(descriptionNeedsExpand('短'), false);
  assert.equal(descriptionNeedsExpand('字'.repeat(141)), true);
});

test('GameDetail_应严格对齐效果图结构与文案键', () => {
  const tsx = read('src/page/GameDetail.tsx');
  const css = read('src/page/GameDetail.module.css');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(tsx, /gameDetail\.pageTitle/);
  assert.match(tsx, /styles\.pageTitle/);
  assert.match(tsx, /styles\.coverTypeBadge/);
  assert.match(tsx, /styles\.backIconButton/);
  assert.match(tsx, /M15 6L9 12L15 18/);
  assert.doesNotMatch(tsx, /nav_back\.webp/);
  assert.match(css, /\.backIconButton svg\s*\{[^}]*stroke-width:\s*1\.8/);
  assert.match(tsx, /styles\.statsBar/);
  assert.match(tsx, /styles\.heroMetaRow/);
  assert.match(tsx, /styles\.heroMetaActions/);
  assert.match(tsx, /styles\.heroAuthorAvatar/);
  assert.match(tsx, /resolveGameCardAuthor/);
  assert.match(tsx, /styles\.synopsisTitle/);
  assert.match(tsx, /styles\.updateLogCard/);
  assert.match(css, /\.heroAuthorAvatar[\s\S]*border-radius:\s*50%/);
  assert.match(tsx, /gameDetail\.plotSynopsis/);
  assert.match(tsx, /gameDetail\.readMore/);
  assert.match(tsx, /gameDetail\.storyReplay/);
  assert.match(tsx, /gameDetail\.updateLog/);
  assert.match(tsx, /gameDetail\.updateLogRecent/);
  assert.match(tsx, /gameDetail\.issueFeedbackEntry/);
  assert.match(tsx, /DetailShareIcon/);
  assert.match(tsx, /DetailHeartIcon/);
  assert.match(tsx, /DetailStarIcon/);
  assert.match(tsx, /DetailRateIcon/);
  assert.match(tsx, /icon_filmstrip\.webp/);
  assert.match(tsx, /loadSaveBadge/);
  assert.match(tsx, /inlineActionRow/);
  assert.doesNotMatch(tsx, /floatingActionBar/);
  assert.doesNotMatch(tsx, /gameDetail\.workInfo/);
  assert.doesNotMatch(tsx, /FaRegShareFromSquare|IoChevronBack/);
  assert.match(css, /\.statsBar/);
  assert.match(css, /\.statsBar[\s\S]*gap:\s*0\.55rem/);
  assert.match(css, /\.statsItem[\s\S]*flex-direction:\s*row/);
  assert.match(css, /\.statsItem[\s\S]*border-radius:\s*11\.5px/);
  assert.match(css, /\.statsText[\s\S]*flex-direction:\s*row/);
  assert.match(css, /\.statsValue[\s\S]*color:\s*inherit/);
  assert.match(css, /\.heroGameTitle/);
  assert.match(css, /\.replayButton/);
  assert.match(css, /\.bottomActionRow[\s\S]*flex-direction:\s*column/);
  /* 双 CTA 字号在各断点保持一致（含 replay） */
  assert.match(css, /\.startButton,\s*\n\s*\.purchaseButton,\s*\n\s*\.replayButton/);
  assert.doesNotMatch(css, /\.startButton,\s*\n\s*\.purchaseButton\s*\{[^}]*font-size:\s*0\.9375rem/);
  assert.match(css, /\.topBar\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.topBar\s*\{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.2\)/);
  assert.match(css, /\.heroSectionCoverOnly::after[\s\S]*var\(--detail-surface\)/);
  assert.doesNotMatch(css, /@media \(max-width:\s*768px\)[\s\S]*\.heroSection::after[\s\S]*mobile-content-image-guard-dark-gradient/);
  assert.match(css, /\.descriptionSection p\.descriptionCollapsed[\s\S]*?-webkit-line-clamp:\s*4/);
  assert.match(css, /\.descriptionSection p\.descriptionCollapsed[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.ratingBadge\s*\{[^}]*color:\s*var\(--detail-star\)/);
  assert.match(css, /\.coverTypeBadge\s*\{[^}]*background:\s*rgba\(168,\s*40,\s*60,\s*0\.88\)/);
  assert.match(css, /\.updateLogCard\s*\{[^}]*background:\s*#141416/);
  assert.match(css, /\.readMoreButton\s*\{[^}]*color:\s*#F16C83/);
  assert.match(css, /\.pageContainer\s*\{[^}]*--primary:\s*#A8283C/);
  assert.match(css, /\.backIconButton,\s*\n\s*\.topIconButton\s*\{[^}]*background:\s*#141417/);
  assert.match(css, /\.statsItem\s*\{[^}]*background:\s*var\(--detail-card\)/);
  assert.match(css, /\.sectionBlock/);
  /* 功能注释：PC / 窄屏均有封面与三钮自适应，避免只适配效果图手机稿 */
  assert.match(css, /@media \(min-width:\s*769px\)[\s\S]*\.heroSectionCoverOnly/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*\.contentSectionFlow/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*\.statsBar/);
  assert.match(zh, /"plotSynopsis":\s*"剧情简介"/);
  assert.match(zh, /"storyReplay":\s*"视觉小说"/);
  assert.match(zh, /"readMore":\s*"展开全文"/);
  assert.match(zh, /"pageTitle":\s*"作品详情"/);
  assert.match(zh, /"updateLog":\s*"更新日志"/);
  assert.match(zh, /"updateLogRecent":\s*"最近"/);
  assert.match(zh, /"issueFeedbackEntry":\s*"游戏故障反馈"/);
  assert.doesNotMatch(zh, /"storyReplay":\s*"剧情回放"/);
});
