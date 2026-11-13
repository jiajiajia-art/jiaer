/**
 * 活动中心列表展示辅助与效果图结构回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPromotionSubmissionStats,
  collectAcceptedSubmissionLabels,
  formatPromotionEndTimeBadge,
  formatSubmissionListDate,
  joinPromotionFormLabels,
  resolveSubmissionCoverUrl,
  resolveSubmissionListBadgeTone,
} from '../src/lib/promotionCenterView.ts';

// 展示按本地时区格式化；固定为北京时间，避免在 UTC 的 CI / 沙箱里结果不同
process.env.TZ = 'Asia/Shanghai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('formatPromotionEndTimeBadge_应按月日时分展示结束时间', () => {
  assert.equal(
    formatPromotionEndTimeBadge(
      { endAt: '2026-04-26T23:59:00+08:00', isLongTerm: false },
      { longTerm: '长期活动', endTimePrefix: '结束时间' },
    ),
    '结束时间 04月26日23:59',
  );
  assert.equal(
    formatPromotionEndTimeBadge(
      { endAt: null, isLongTerm: true },
      { longTerm: '长期活动', endTimePrefix: '结束时间' },
    ),
    '长期活动',
  );
  assert.equal(
    formatPromotionEndTimeBadge(
      { endAt: 'not-a-date', isLongTerm: false },
      { longTerm: '长期活动', endTimePrefix: '结束时间' },
    ),
    '长期活动',
  );
});

test('collectAcceptedSubmissionLabels_与join_应对齐投稿形式文案', () => {
  const labels = collectAcceptedSubmissionLabels(
    { acceptTexts: true, acceptLinks: false, acceptImages: true, acceptVideos: false },
    {
      text: '文本投稿',
      link: '链接投稿',
      image: '图片投稿',
      video: '视频投稿',
    },
  );
  assert.deepEqual(labels, ['文本投稿', '图片投稿']);
  assert.equal(joinPromotionFormLabels(labels), '文本投稿，图片投稿');
  assert.equal(joinPromotionFormLabels([]), '');
});

test('resolveSubmissionListBadgeTone_与统计_应对齐三态', () => {
  assert.equal(resolveSubmissionListBadgeTone('pending_review'), 'reviewing');
  assert.equal(resolveSubmissionListBadgeTone('rejected'), 'returned');
  assert.equal(resolveSubmissionListBadgeTone('approved'), 'published');
  assert.equal(resolveSubmissionListBadgeTone('reward_issued'), 'published');
  assert.deepEqual(
    buildPromotionSubmissionStats([
      { reviewStatus: 'pending_review' },
      { reviewStatus: 'pending_review' },
      { reviewStatus: 'approved' },
      { reviewStatus: 'rejected' },
      { reviewStatus: 'reward_issued' },
    ]),
    { total: 5, reviewing: 2, published: 2 },
  );
});

test('formatSubmissionListDate_与封面解析', () => {
  assert.equal(formatSubmissionListDate('2026-03-03T12:00:00+08:00'), '2026.3.3');
  assert.equal(formatSubmissionListDate(null), '');
  assert.equal(
    resolveSubmissionCoverUrl({
      activityCoverImageUrl: '',
      activityCoverFromList: '/a.webp',
      firstPayloadImage: '/b.webp',
    }),
    '/a.webp',
  );
  assert.equal(
    resolveSubmissionCoverUrl({
      activityCoverImageUrl: null,
      activityCoverFromList: null,
      firstPayloadImage: '/b.webp',
    }),
    '/b.webp',
  );
});

test('PromotionCenter_应对齐效果图顶栏Tab与卡片结构', () => {
  const tsx = read('src/page/PromotionCenter.tsx');
  const css = read('src/page/PromotionCenter.module.css');
  const zh = read('src/i18n/locales/zh.json');

  assert.match(tsx, /promotion\.pageTitle/);
  assert.match(tsx, /promotion\.backAria/);
  assert.match(tsx, /promotion\.hotActivities/);
  assert.match(tsx, /promotion\.goParticipate/);
  assert.match(tsx, /M15 6L9 12L15 18/);
  assert.match(tsx, /formatPromotionEndTimeBadge/);
  assert.match(tsx, /styles\.endTimeBadge/);
  assert.match(tsx, /styles\.cardDivider/);
  assert.match(tsx, /styles\.cardMainRow/);
  assert.match(tsx, /styles\.metaDetailList/);
  assert.match(tsx, /styles\.submissionStatsCard/);
  assert.match(tsx, /styles\.viewDetailButton/);
  assert.match(tsx, /promotion\.viewDetails/);
  assert.match(tsx, /setDetailSubmission/);
  assert.doesNotMatch(tsx, /promotion\.publishedActivities\}\(/);
  assert.doesNotMatch(tsx, /promotion\.heroText/);
  assert.doesNotMatch(tsx, /←/);

  assert.match(css, /\.pageHeader\s*\{/);
  assert.match(css, /\.backButton\s*\{[^}]*left:\s*0/);
  assert.match(css, /\.endTimeBadge\s*\{/);
  assert.match(css, /\.cardDivider\s*\{[\s\S]*?border-top:\s*1\.5px dashed/);
  assert.match(css, /\.metaDetailRow\s*\{/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.tabRow\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.submissionStatsCard\s*\{/);
  assert.match(css, /\.listStatusBadge\s*\{/);
  assert.match(css, /\.viewDetailButton\s*\{/);

  assert.match(zh, /"pageTitle":\s*"活动中心"/);
  assert.match(zh, /"hotActivities":\s*"热门活动"/);
  assert.match(zh, /"goParticipate":\s*"去参与"/);
  assert.match(zh, /"viewDetails":\s*"查看详情"/);
  assert.match(zh, /"statsTotal":\s*"总投稿"/);
  assert.match(zh, /"oncePerActivity":\s*"活动期内限制1次"/);
});
