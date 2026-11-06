import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRankingsVisibleAllSectionKey,
  isRankingsVisibleTabKey,
  RANKINGS_VISIBLE_ALL_SECTION_KEYS,
  RANKINGS_VISIBLE_TAB_KEYS,
  resolveRankingsHeatAndFavorite,
} from '../src/lib/rankingsUi.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rankingsPage = readFileSync(join(root, 'src/page/Rankings.tsx'), 'utf8');
const rankingsCss = readFileSync(join(root, 'src/page/Rankings.module.css'), 'utf8');

test('排行榜可见 Tab 仅全部/人气/新作/作者_飙升互动仍保留配置', () => {
  assert.deepEqual([...RANKINGS_VISIBLE_TAB_KEYS], ['all', 'hot', 'new', 'authors']);
  assert.equal(isRankingsVisibleTabKey('rising'), false);
  assert.equal(isRankingsVisibleTabKey('romance'), false);
  assert.equal(isRankingsVisibleTabKey('hot'), true);
  assert.match(rankingsPage, /labelZh:\s*'飙升榜'/);
  assert.match(rankingsPage, /labelZh:\s*'互动榜'/);
  assert.match(rankingsPage, /RANKINGS_VISIBLE_TAB_KEYS|isRankingsVisibleTabKey/);
  assert.match(rankingsPage, /rising:\s*'hot'/);
  assert.match(rankingsPage, /romance:\s*'interaction'/);
});

test('全部页分区不露出飙升与互动', () => {
  assert.deepEqual([...RANKINGS_VISIBLE_ALL_SECTION_KEYS], ['overall', 'new', 'authors']);
  assert.equal(isRankingsVisibleAllSectionKey('hot'), false);
  assert.equal(isRankingsVisibleAllSectionKey('interaction'), false);
  assert.equal(isRankingsVisibleAllSectionKey('overall'), true);
  assert.match(rankingsPage, /isRankingsVisibleAllSectionKey/);
});

test('热度收藏取值_UV优先且收藏回落点赞', () => {
  assert.deepEqual(
    resolveRankingsHeatAndFavorite({
      total_uv_count: 12,
      total_pv_count: 99,
      favorite_count: 3,
      like_count: 8,
    }),
    { heat: 12, favorite: 3 },
  );
  assert.deepEqual(
    resolveRankingsHeatAndFavorite({
      total_pv_count: 40,
      like_count: 7,
    }),
    { heat: 40, favorite: 7 },
  );
  assert.deepEqual(
    resolveRankingsHeatAndFavorite({}),
    { heat: 0, favorite: 0 },
  );
});

test('排行榜卡片含作者头像简介两行与热度收藏且可纵向滚动', () => {
  assert.match(rankingsPage, /authorAvatarSrc|categoryBoxAuthorAvatar|horizontalCardAuthorAvatar/);
  assert.match(rankingsPage, /CardFlameIcon/);
  assert.match(rankingsPage, /CardHeartIcon/);
  assert.match(rankingsPage, /resolveRankingsHeatAndFavorite/);
  assert.match(rankingsPage, /categoryBoxDesc|horizontalCardDesc/);
  assert.match(rankingsCss, /-webkit-line-clamp:\s*2/);
  assert.match(rankingsCss, /touch-action:\s*pan-x\s+pan-y|touch-action:\s*manipulation/);
  assert.doesNotMatch(rankingsCss, /\.tabBar\s*\{[^}]*touch-action:\s*pan-x\s*;/);
  assert.match(rankingsPage, /mainRef|loadMore|hasMore|IntersectionObserver|onScroll/);
});
