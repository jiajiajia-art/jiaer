/**
 * 功能注释：防止 GameRating 评论拉取因父回调引用变化死循环刷接口。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ratingStatsEqual } from '../src/utils/ratingStatsSync.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gameRatingSrc = readFileSync(join(root, 'src/components/GameRating/GameRating.tsx'), 'utf8');
const gameDetailSrc = readFileSync(join(root, 'src/page/GameDetail.tsx'), 'utf8');

test('ratingStatsEqual_相同汇总应视为不变', () => {
  assert.equal(
    ratingStatsEqual({ average: 4.5, count: 12 }, { average: 4.5, count: 12 }),
    true,
  );
  assert.equal(
    ratingStatsEqual({ average: null, count: 0 }, { average: null, count: 0 }),
    true,
  );
});

test('ratingStatsEqual_汇总变化时应视为不同', () => {
  assert.equal(
    ratingStatsEqual({ average: 4.5, count: 12 }, { average: 4.6, count: 12 }),
    false,
  );
  assert.equal(
    ratingStatsEqual({ average: null, count: 0 }, { average: 5, count: 1 }),
    false,
  );
});

test('GameRating_fetchRatings依赖不得包含父级回调_避免死循环', () => {
  assert.match(gameRatingSrc, /onRatingChangeRef/);
  assert.match(gameRatingSrc, /onUserRatingChangeRef/);
  // 功能注释：抓「依赖数组末尾仍挂回调」的回归；允许 fileId/sortMode
  assert.doesNotMatch(
    gameRatingSrc,
    /}, \[fileId, sortMode, onRatingChange, onUserRatingChange\]\)/,
  );
  assert.match(gameRatingSrc, /}, \[fileId, sortMode\]\);/);
});

test('GameDetail_评论区应使用稳定汇总回调而非内联setRatingStats', () => {
  assert.match(gameDetailSrc, /applyRatingSummaryFromComments/);
  assert.match(gameDetailSrc, /onRatingChange=\{applyRatingSummaryFromComments\}/);
  assert.doesNotMatch(
    gameDetailSrc,
    /onRatingChange=\{\(summary\)\s*=>\s*\{[\s\S]*?setRatingStats\(/,
  );
});
