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

test('descriptionNeedsExpand_长文才需要阅读更多', () => {
  assert.equal(descriptionNeedsExpand('短'), false);
  assert.equal(descriptionNeedsExpand('字'.repeat(141)), true);
});

test('GameDetail_应严格对齐效果图结构与文案键', () => {
  const tsx = read('src/page/GameDetail.tsx');
  const css = read('src/page/GameDetail.module.css');
  const zh = read('src/i18n/locales/zh.json');
  assert.doesNotMatch(tsx, /gameDetail\.pageTitle/);
  assert.doesNotMatch(tsx, /styles\.pageTitle/);
  assert.match(tsx, /styles\.backIconButton/);
  assert.match(tsx, /M15 6L9 12L15 18/);
  assert.doesNotMatch(tsx, /nav_back\.webp/);
  assert.match(css, /\.backIconButton svg\s*\{[^}]*stroke-width:\s*2\.4/);
  assert.match(tsx, /styles\.statsBar/);
  assert.match(tsx, /styles\.heroContent/);
  assert.match(css, /\.heroContent\s*\{[^}]*padding:\s*0 20px 1\.25rem 10px/);
  assert.match(tsx, /styles\.heroMetaRow/);
  assert.match(tsx, /styles\.heroAuthorAvatar/);
  assert.match(tsx, /resolveGameCardAuthor/);
  assert.match(tsx, /styles\.synopsisTitle/);
  assert.match(css, /\.heroAuthorAvatar[\s\S]*border-radius:\s*50%/);
  assert.match(tsx, /gameDetail\.plotSynopsis/);
  assert.match(tsx, /gameDetail\.readMore/);
  assert.match(tsx, /gameDetail\.storyReplay/);
  assert.match(tsx, /DetailShareIcon/);
  assert.match(tsx, /DetailHeartIcon/);
  assert.match(tsx, /DetailStarIcon/);
  assert.match(tsx, /icon_filmstrip\.webp/);
  assert.match(tsx, /loadSaveBadge/);
  assert.doesNotMatch(tsx, /FaRegShareFromSquare|IoChevronBack|AiOutlineStar/);
  assert.match(css, /\.statsBar/);
  assert.match(css, /\.statsBar[\s\S]*border-radius:\s*20px/);
  assert.match(css, /\.statsItem[\s\S]*flex-direction:\s*row/);
  assert.match(css, /\.statsIconWrap[\s\S]*border-radius:\s*999px/);
  assert.match(css, /\.statsValue[\s\S]*color:\s*#FFFFFF/);
  assert.match(css, /\.heroGameTitle/);
  assert.match(css, /\.replayButton/);
  assert.match(css, /\.bottomActionRow[\s\S]*flex-direction:\s*column/);
  assert.match(css, /\.floatingActionInner[\s\S]*1\.35rem \+ env\(safe-area-inset-bottom/);
  /* 双 CTA 字号在各断点保持一致（含 replay） */
  assert.match(css, /\.startButton,\s*\n\s*\.purchaseButton,\s*\n\s*\.replayButton/);
  assert.doesNotMatch(css, /\.startButton,\s*\n\s*\.purchaseButton\s*\{[^}]*font-size:\s*0\.9375rem/);
  assert.match(css, /\.topBar\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.heroSection::after[\s\S]*rgba\(0,\s*0,\s*0,\s*0\)\s*0%/);
  assert.doesNotMatch(css, /@media \(max-width:\s*768px\)[\s\S]*\.heroSection::after[\s\S]*mobile-content-image-guard-dark-gradient/);
  assert.match(css, /\.descriptionSection p\.descriptionCollapsed[\s\S]*?-webkit-line-clamp:\s*4/);
  assert.match(css, /\.descriptionSection p\.descriptionCollapsed[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.ratingBadge\s*\{[^}]*background:\s*rgba\(142,\s*33,\s*53,\s*0\.58\)/);
  assert.match(css, /\.ratingBadge\s*\{[^}]*backdrop-filter:\s*blur\(10px\)/);
  assert.doesNotMatch(css, /\.ratingBadge\s*\{[^}]*background:\s*#8E2135/);
  assert.match(zh, /"plotSynopsis":\s*"剧情简介"/);
  assert.match(zh, /"storyReplay":\s*"视觉小说"/);
  assert.match(zh, /"readMore":\s*"阅读更多"/);
  assert.doesNotMatch(zh, /"storyReplay":\s*"剧情回放"/);
});
