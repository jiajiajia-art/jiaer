import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearRankingsLoadingFlags,
  isRankingsVisibleAllSectionKey,
  isRankingsVisibleTabKey,
  mergeRankingsUniqueById,
  RANKINGS_VISIBLE_ALL_SECTION_KEYS,
  RANKINGS_VISIBLE_TAB_KEYS,
  resolveRankingsHasMore,
  resolveRankingsHeatAndFavorite,
  resolveRankingsPanelKind,
  resolveRankingsPlainDescription,
  shouldFetchRankingsTab,
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

test('排行榜卡片含作者头像简介单行与热度收藏且可纵向滚动', () => {
  assert.match(rankingsPage, /authorAvatarSrc|categoryBoxAuthorAvatar|horizontalCardAuthorAvatar/);
  assert.match(rankingsPage, /CardFlameIcon/);
  assert.match(rankingsPage, /CardHeartIcon/);
  assert.match(rankingsPage, /resolveRankingsHeatAndFavorite/);
  assert.match(rankingsPage, /categoryBoxDesc|horizontalCardDesc/);
  const descBlock = rankingsCss.match(/\.horizontalCardDesc\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(descBlock, /white-space:\s*nowrap/);
  assert.match(descBlock, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(descBlock, /-webkit-line-clamp:\s*2/);
  assert.match(rankingsCss, /touch-action:\s*pan-x\s+pan-y|touch-action:\s*manipulation/);
  assert.doesNotMatch(rankingsCss, /\.tabBar\s*\{[^}]*touch-action:\s*pan-x\s*;/);
  assert.match(rankingsPage, /mainRef|loadMore|hasMore|IntersectionObserver|onScroll/);
});

test('榜单简介须剥HTML标签_禁止露出p标签', () => {
  assert.equal(
    resolveRankingsPlainDescription('<p>故事发生在2026年的现代都市</p>'),
    '故事发生在2026年的现代都市',
  );
  assert.equal(
    resolveRankingsPlainDescription('<p>第一行</p><p>第二行</p>'),
    '第一行 第二行',
  );
  assert.equal(resolveRankingsPlainDescription('纯文本简介'), '纯文本简介');
  assert.equal(resolveRankingsPlainDescription(''), '');
  assert.doesNotMatch(resolveRankingsPlainDescription('<p>有标签</p>'), /<p>/);
  assert.match(rankingsPage, /resolveRankingsPlainDescription/);
  assert.match(rankingsPage, /plainDescription|resolveRankingsPlainDescription\(item\.description/);
});

test('热度收藏须在简介上方且左对齐_禁止贴底留白', () => {
  const statsBlock = (rankingsCss.match(/\.horizontalCardStats,\s*\.categoryBoxStats\s*\{[^}]*\}/)?.[0] ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(statsBlock, /justify-content:\s*flex-start/);
  assert.match(statsBlock, /margin-top:\s*0/);
  assert.doesNotMatch(statsBlock, /justify-content:\s*flex-end/);
  assert.doesNotMatch(statsBlock, /margin-top:\s*auto/);
  /* 功能注释：单榜渲染顺序须先 stats 后 desc */
  const apiContent = rankingsPage.slice(
    rankingsPage.indexOf('const renderApiContent'),
    rankingsPage.indexOf('return (\n        <AppPageShell'),
  );
  const statsAt = apiContent.indexOf('renderHeatFavorite(game, styles.horizontalCardStats)');
  const descAt = apiContent.indexOf('styles.horizontalCardDesc');
  assert.ok(statsAt > 0 && descAt > statsAt, 'stats must render above description');
});

test('PC与移动端作者与热度收藏统一同行', () => {
  assert.match(rankingsPage, /styles\.authorStatsRow/);
  const rowBlock = rankingsCss.match(/\.authorStatsRow\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(rowBlock, /flex-direction:\s*row/);
  assert.match(rowBlock, /justify-content:\s*space-between/);
  assert.match(rowBlock, /margin-top:\s*5px/);
  assert.match(rowBlock, /margin-bottom:\s*5px/);
  assert.doesNotMatch(rowBlock, /flex-direction:\s*column/);
  /* 功能注释：全部页分区与人气/新作单榜都要包 authorStatsRow；作者榜不走这套 */
  assert.match(rankingsPage, /categoryBoxInfo[\s\S]*?authorStatsRow[\s\S]*?categoryBoxAuthorAvatar/);
  const authorList = rankingsPage.slice(
    rankingsPage.indexOf('const renderAuthorList'),
    rankingsPage.indexOf('const renderApiContent'),
  );
  assert.doesNotMatch(authorList, /authorStatsRow/);
});

test('移动端作者头像与昵称高度缩小约20%', () => {
  const mobileCss = rankingsCss.match(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*$/)?.[0] ?? '';
  assert.match(mobileCss, /AuthorAvatar[\s\S]{0,80}?width:\s*14px/);
  assert.match(mobileCss, /AuthorAvatar[\s\S]{0,80}?height:\s*14px/);
  assert.match(mobileCss, /\.authorStatsRow\s+\.horizontalCardAuthor[\s\S]{0,80}?font-size:\s*10px/);
  /* 功能注释：PC 头像保持 18px，禁止被移动端覆盖写进基础样式 */
  const desktopAvatar = rankingsCss.match(/\.horizontalCardAuthorAvatar,\s*\n?\s*\.categoryBoxAuthorAvatar\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(desktopAvatar, /width:\s*18px/);
  assert.match(desktopAvatar, /height:\s*18px/);
  assert.doesNotMatch(mobileCss, /\.authorStatsRow\s+\.authorByline\s*\{[^}]*max-width:\s*20%/);
});

test('Tab与榜单内容间距收紧_移动端底边距为0', () => {
  const tabBlock = rankingsCss.match(/\.tabBar\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(tabBlock, /margin:\s*20px\s+0\s+12px/);
  assert.doesNotMatch(tabBlock, /margin:\s*20px\s+0\s+32px/);
  const mobileCss = rankingsCss.match(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*$/)?.[0] ?? '';
  const mobileTab = mobileCss.match(/\.tabBar\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(mobileTab, /margin:\s*8px\s+-16px\s+0/);
  assert.doesNotMatch(mobileTab, /margin:\s*8px\s+-16px\s+18px/);
  const mobileHeader = mobileCss.match(/\.categoryBoxHeader\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(mobileHeader, /padding:\s*8px\s+0/);
});

test('移动端名次徽标高度缩小约20%', () => {
  const mobileCss = rankingsCss.match(/@media\s*\(\s*max-width:\s*768px\s*\)\s*\{[\s\S]*$/)?.[0] ?? '';
  const badgeBlock = mobileCss.match(/\.horizontalCardBadge\s*\{[^}]*\}/)?.[0] ?? '';
  const badgeImgBlock = mobileCss.match(/\.horizontalCardBadgeImage\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(badgeBlock, /width:\s*19px/);
  assert.match(badgeBlock, /height:\s*19px/);
  assert.match(badgeBlock, /font-size:\s*11px/);
  assert.match(badgeImgBlock, /width:\s*19px/);
  assert.match(badgeImgBlock, /height:\s*19px/);
  const desktopBadge = rankingsCss.match(/\.horizontalCardBadge\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(desktopBadge, /width:\s*24px/);
  assert.match(desktopBadge, /height:\s*24px/);
});

test('单榜卡简介贴齐封面底边_信息列与封面同高', () => {
  const cardBlock = rankingsCss.match(/\.horizontalCard\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(cardBlock, /align-items:\s*stretch/);
  const infoBlock = rankingsCss.match(/\.horizontalCardInfo\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(infoBlock, /align-self:\s*stretch/);
  const descBlock = rankingsCss.match(/\.horizontalCardDesc\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(descBlock, /margin-top:\s*auto/);
});

test('全部页分区卡无题材标签也不占位_简介贴齐封面底边', () => {
  const itemBlock = rankingsCss.match(/\.categoryBoxItem\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(itemBlock, /align-items:\s*stretch/);
  const coverWrap = rankingsCss.match(/\.categoryBoxCoverWrap\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(coverWrap, /align-self:\s*flex-start/);
  const infoBlock = rankingsCss.match(/\.categoryBoxInfo\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(infoBlock, /align-self:\s*stretch/);
  assert.match(infoBlock, /gap:\s*0/);
  const descBlock = rankingsCss.match(/\.categoryBoxDesc\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(descBlock, /margin-top:\s*auto/);
  /* 功能注释：题材 pill 仅有数据时渲染，禁止空占位壳 */
  assert.match(rankingsPage, /themeTags\.length\s*>\s*0\s*\?/);
  const metaBlock = rankingsCss.match(/\.categoryBoxMeta\s*\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(metaBlock, /min-height:\s*[1-9]/);
});

test('大标题默认单行省略_禁止标题两行撑高卡片', () => {
  const titleBlock = rankingsCss.match(/\.horizontalCardTitle\s*\{[^}]*\}/)?.[0] ?? '';
  const categoryTitleBlock = rankingsCss.match(/\.categoryBoxTitle2\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(titleBlock, /white-space:\s*nowrap/);
  assert.match(titleBlock, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(titleBlock, /-webkit-line-clamp:\s*2/);
  assert.match(categoryTitleBlock, /white-space:\s*nowrap/);
  assert.doesNotMatch(categoryTitleBlock, /-webkit-line-clamp:\s*2/);
});

test('排行榜page类禁止盖掉壳层absolute_滚动区定位上下文放pageInner', () => {
  const pageBlock = rankingsCss.match(/\.page\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.doesNotMatch(pageBlock, /position\s*:/);
  assert.match(rankingsCss, /\.pageInner\s*\{[\s\S]*?position:\s*relative/);
  assert.match(rankingsPage, /mainClassName=\{styles\.page\}/);
});

test('Tab面板映射_全部三列/人气单榜/作者单榜互斥', () => {
  assert.equal(resolveRankingsPanelKind('all'), 'all-grid');
  assert.equal(resolveRankingsPanelKind('hot'), 'game-list');
  assert.equal(resolveRankingsPanelKind('new'), 'game-list');
  assert.equal(resolveRankingsPanelKind('authors'), 'author-list');
  assert.equal(resolveRankingsPanelKind('rising'), 'game-list');
  assert.match(rankingsPage, /data-rankings-panel=\{resolveRankingsPanelKind\(activeTab\)\}/);
  assert.match(rankingsPage, /activeTab === 'all'/);
  assert.match(rankingsPage, /activeTab === 'authors'/);
});

test('全部页三列禁止等高撑开且作者不用作品封面4比3', () => {
  assert.match(rankingsCss, /\.allTabGrid\s*\{[^}]*align-items:\s*start/);
  assert.match(rankingsCss, /\.categoryBox\s*\{[\s\S]*?height:\s*fit-content/);
  assert.match(rankingsCss, /\.categoryBoxList\s*\{[\s\S]*?flex:\s*0\s+1\s+auto/);
  assert.match(rankingsPage, /categoryBoxAuthorAvatarWrap/);
  assert.match(rankingsPage, /categoryBoxAuthorAvatarImg/);
  assert.match(rankingsCss, /\.categoryBoxAuthorAvatarWrap\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.match(rankingsCss, /\.categoryBoxAuthorAvatarWrap\s*\{[\s\S]*?width:\s*56px/);
  assert.match(rankingsCss, /\.categoryBoxAuthorAvatarWrap\s*\{[\s\S]*?height:\s*56px/);
  /* 功能注释：回归——禁止再把作者头像套上 categoryBoxCover（4:3）导致椭圆留白 */
  assert.doesNotMatch(
    rankingsPage,
    /categoryBoxCover\}[^`]*authorListAvatar|authorListAvatar\}[^`]*categoryBoxCover/,
  );
  assert.doesNotMatch(
    rankingsPage,
    /className=\{`\$\{styles\.categoryBoxCover\} \$\{styles\.authorListAvatar\}`\}/,
  );
});

test('人气与作者单榜卡高度随内容_作者卡垂直居中', () => {
  assert.match(rankingsCss, /\.horizontalSection\s*\{[\s\S]*?align-items:\s*start/);
  assert.match(rankingsCss, /\.horizontalCard\s*\{[\s\S]*?min-height:\s*0/);
  assert.match(rankingsCss, /\.horizontalCard\s*\{[\s\S]*?height:\s*fit-content/);
  assert.match(rankingsPage, /horizontalAuthorCard/);
  assert.match(rankingsCss, /\.horizontalAuthorCard\s*\{[\s\S]*?align-items:\s*center/);
  assert.match(rankingsCss, /\.authorAvatarWrap\s*\{[\s\S]*?width:\s*72px/);
  assert.match(rankingsCss, /\.authorAvatarWrap\s*\{[\s\S]*?height:\s*72px/);
});

test('作者单榜PC左对齐_单列贴左不走作品双列网格', () => {
  assert.match(rankingsPage, /styles\.authorSection/);
  assert.match(rankingsCss, /\.authorSection\s*\{[\s\S]*?align-items:\s*stretch/);
  assert.match(rankingsCss, /\.authorSection\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(rankingsCss, /\.authorSection\s*\{[\s\S]*?max-width:\s*720px/);
  assert.match(rankingsCss, /\.authorSection\s*\{[\s\S]*?margin-left:\s*0/);
  assert.match(rankingsCss, /\.authorSection\s*\{[\s\S]*?margin-right:\s*auto/);
  assert.match(rankingsCss, /\.horizontalAuthorCard\s*\{[\s\S]*?width:\s*100%/);
  assert.match(rankingsCss, /\.horizontalAuthorCard\s*\{[\s\S]*?justify-content:\s*flex-start/);
  /* 功能注释：作者列表容器禁止再复用 horizontalSection 的 PC 双列 */
  const authorListReturn = rankingsPage.slice(
    rankingsPage.indexOf('const renderAuthorList'),
    rankingsPage.indexOf('const renderApiContent'),
  );
  assert.match(authorListReturn, /authorSection/);
  assert.doesNotMatch(authorListReturn, /styles\.horizontalSection/);
});

test('切Tab中止后须清loading且按loaded决定是否重拉_禁止!loading门闩卡死', () => {
  assert.equal(shouldFetchRankingsTab({ loaded: false, loading: false }), true);
  /* 功能注释：loading 残留为 true 时仍应允许重拉，否则来回点两次 Tab 就废了 */
  assert.equal(shouldFetchRankingsTab({ loaded: false, loading: true }), true);
  assert.equal(shouldFetchRankingsTab({ loaded: true, loading: false }), false);
  assert.deepEqual(
    clearRankingsLoadingFlags({ loaded: false, loading: true, loadingMore: true, data: [1] }),
    { loaded: false, loading: false, loadingMore: false, data: [1] },
  );
  assert.deepEqual(
    clearRankingsLoadingFlags({ loaded: false, loading: true, data: {}, authors: [] }),
    { loaded: false, loading: false, data: {}, authors: [] },
  );
  assert.match(rankingsPage, /shouldFetchRankingsTab/);
  assert.match(rankingsPage, /clearRankingsLoadingFlags|releaseGameTabLoading|releaseAllTabLoading/);
  assert.match(rankingsPage, /signal:\s*controller\.signal/);
  assert.doesNotMatch(rankingsPage, /!allTabState\.loaded && !allTabState\.loading/);
  assert.doesNotMatch(rankingsPage, /!authorTabState\.loaded && !authorTabState\.loading/);
  assert.doesNotMatch(rankingsPage, /!tabState\?\.loaded && !tabState\?\.loading/);
});

test('面板须key=activeTab强制卸载_禁止全部与单榜DOM复用串台', () => {
  assert.match(rankingsPage, /key=\{activeTab\}/);
  assert.match(rankingsPage, /data-rankings-panel=\{resolveRankingsPanelKind\(activeTab\)\}/);
  assert.match(rankingsPage, /mergeRankingsUniqueById/);
  assert.match(rankingsPage, /resolveRankingsHasMore/);
});

test('分页去重与hasMore_重复页或空页必须停翻', () => {
  assert.equal(
    resolveRankingsHasMore({ pageSize: 20, fetchedCount: 20, newUniqueCount: 20 }),
    true,
  );
  assert.equal(
    resolveRankingsHasMore({ pageSize: 20, fetchedCount: 7, newUniqueCount: 7 }),
    false,
  );
  assert.equal(
    resolveRankingsHasMore({ pageSize: 20, fetchedCount: 20, newUniqueCount: 0 }),
    false,
  );
  assert.equal(
    resolveRankingsHasMore({ pageSize: 20, fetchedCount: 0, newUniqueCount: 0 }),
    false,
  );
  const once = mergeRankingsUniqueById(
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'b' }, { id: 'c' }, { id: 'a' }],
    (x) => x.id,
  );
  assert.deepEqual(once.merged.map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(once.newUniqueCount, 1);
  const dupPage = mergeRankingsUniqueById(
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'a' }, { id: 'b' }],
    (x) => x.id,
  );
  assert.equal(dupPage.newUniqueCount, 0);
  assert.equal(
    resolveRankingsHasMore({
      pageSize: 20,
      fetchedCount: 2,
      newUniqueCount: dupPage.newUniqueCount,
    }),
    false,
  );
});
