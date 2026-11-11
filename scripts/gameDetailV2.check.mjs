/**
 * 新版作品详情：效果图信息结构 + 平台视觉组件接线回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('GameDetail_v2_应按效果图模块顺序且按钮在正文流', () => {
  const tsx = read('src/page/GameDetail.tsx');
  const css = read('src/page/GameDetail.module.css');
  assert.match(tsx, /data-layout="game-detail-v2"/);
  assert.match(tsx, /topBarContentSplit/);
  assert.match(tsx, /styles\.pageTitle/);
  assert.match(tsx, /gameDetail\.pageTitle/);
  assert.match(tsx, /heroSectionCoverOnly/);
  assert.match(tsx, /coverTypeBadge/);
  assert.match(tsx, /heroMetaActions/);
  assert.match(tsx, /DetailRateIcon/);
  assert.match(tsx, /handleOpenRating/);
  assert.match(tsx, /GameRatingModal/);
  assert.match(tsx, /GameUpdateLogModal/);
  assert.match(tsx, /GameIssueFeedbackModal/);
  assert.match(tsx, /gameDetail\.updateLog/);
  assert.match(tsx, /updateLogCard/);
  assert.match(tsx, /sectionBlock/);
  assert.match(tsx, /gameDetail\.updateLogRecent/);
  assert.match(tsx, /gameDetail\.issueFeedbackEntry/);
  assert.match(tsx, /mode="comments"/);
  assert.match(tsx, /gameRating\.commentsSection/);
  assert.match(tsx, /inlineActionRow/);
  assert.match(tsx, /rememberPendingDetailIntent/);
  assert.doesNotMatch(tsx, /floatingActionBar/);
  assert.doesNotMatch(tsx, /gameDetail\.versionNotes/);
  assert.doesNotMatch(tsx, /gameDetail\.workInfo/);
  assert.match(css, /\.contentSectionFlow/);
  assert.match(css, /\.inlineActionRow/);
  assert.match(css, /\.coverTypeBadge/);
  assert.match(css, /\.updateLogCard/);
  assert.match(css, /\.feedbackEntry/);
});

test('GameRating_评论区应为每页20且回复3到5', () => {
  const src = read('src/components/GameRating/GameRating.tsx');
  assert.match(src, /const PAGE_SIZE = 20/);
  assert.match(src, /REPLY_DEFAULT_VISIBLE = 3/);
  assert.match(src, /REPLY_EXPANDED_VISIBLE = 5/);
  assert.match(src, /mode\?: 'full' \| 'comments'/);
  assert.match(src, /isCommentsMode/);
});

test('GameDetailExtras_API与运营工单应接线', () => {
  const api = read('src/api/gameDetailExtrasApi.ts');
  const admin = read('src/components/admin/GameIssueAdminManager.tsx');
  const panel = read('src/page/operator/OperatorPanel.tsx');
  assert.match(api, /update-logs/);
  assert.match(api, /customer-service\/game-issue/);
  assert.match(api, /operator\/customer-service\/game-issues/);
  assert.match(admin, /data-customer-service="game-issues"/);
  assert.match(panel, /gameIssues/);
  assert.match(panel, /GameIssueAdminManager/);
});
