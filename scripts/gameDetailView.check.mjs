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
  assert.match(tsx, /gameDetail\.pageTitle/);
  assert.match(tsx, /styles\.statsBar/);
  assert.match(tsx, /styles\.heroContent/);
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
  assert.match(zh, /"pageTitle":\s*"作品详情"/);
  assert.match(zh, /"plotSynopsis":\s*"剧情简介"/);
  assert.match(zh, /"storyReplay":\s*"视觉小说"/);
  assert.match(zh, /"readMore":\s*"阅读更多"/);
  assert.doesNotMatch(zh, /"storyReplay":\s*"剧情回放"/);
});
