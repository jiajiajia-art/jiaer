/**
 * 推荐列表卡片：效果图角标（火焰/心形）+ 作者 byline（头像+名称）/标签/收藏徽标。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_CARD_DEFAULT_AVATAR_PATH,
  resolveGameCardAuthor,
} from '../src/lib/gameCardAuthor.ts';
import {
  resolveGameCardBody,
  resolveGameCardCollectBadge,
  resolveGameCardSubtitle,
  resolveGameCardTags,
  resolveSearchResultSecondaryLine,
} from '../src/lib/gameCardBody.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('resolveGameCardAuthor_有作者名时直出', () => {
  const author = resolveGameCardAuthor({
    author_name: ' 明楼 ',
    avatarUrl: '/avatars/a.webp',
  });
  assert.equal(author.name, '明楼');
  assert.equal(author.avatarUrl, '/avatars/a.webp');
  assert.equal(author.hasNamedAuthor, true);
  assert.match(GAME_CARD_DEFAULT_AVATAR_PATH, /defaultAvatar/);
});

test('resolveGameCardAuthor_缺作者回落未知', () => {
  const author = resolveGameCardAuthor({}, { unknownAuthor: '未知作者' });
  assert.equal(author.name, '未知作者');
  assert.equal(author.hasNamedAuthor, false);
});

test('resolveGameCardBody_应优先subtitle并截断标签', () => {
  const body = resolveGameCardBody({
    subtitle: '如果心跳可以被公式计算',
    description: '很长的描述不应优先',
    theme_tag_names: ['全部', '权谋', '穿越', 'Role-Playing', '多余'],
    like_count: 100,
  });
  assert.equal(body.subtitle, '如果心跳可以被公式计算');
  assert.deepEqual(body.tags, ['权谋', '穿越', 'Role-Playing']);
  assert.equal(body.collectBadge, '100人收藏');
});

test('resolveGameCardSubtitle_无subtitle时截取description', () => {
  const subtitle = resolveGameCardSubtitle({
    description: '权谋与背叛的终极博弈，还有更多不会显示的尾巴',
  });
  assert.match(subtitle, /^权谋与背叛/);
  assert.ok(subtitle.length <= 29);
});

test('resolveSearchResultSecondaryLine_subtitle与标题相同时不重复', () => {
  assert.equal(
    resolveSearchResultSecondaryLine({
      title: '霍去病封狼居胥模拟器',
      subtitle: '霍去病封狼居胥模拟器',
      description: '西汉名将封狼居胥的互动史诗',
    }),
    '西汉名将封狼居胥的互动史诗',
  );
  assert.equal(
    resolveSearchResultSecondaryLine({
      title: '如果我是汉武帝',
      subtitle: '如果我是汉武帝',
      author_name: '史官甲',
    }),
    '史官甲',
  );
  assert.equal(
    resolveSearchResultSecondaryLine({
      title: '同名作品',
      subtitle: '同名作品',
      theme_tag_names: ['古风历史', '权谋争霸'],
    }),
    '古风历史 · 权谋争霸',
  );
  assert.equal(
    resolveSearchResultSecondaryLine({
      title: '空副线',
      subtitle: '空副线',
    }),
    '',
  );
});

test('Navbar_搜索项应使用去重副文案且可隐藏第二行', () => {
  const tsx = readFileSync(join(root, 'src/components/Layout/Navbar.tsx'), 'utf8');
  assert.match(tsx, /resolveSearchResultSecondaryLine/);
  assert.match(tsx, /secondary \? \(/);
  assert.doesNotMatch(tsx, /getSearchResultMeta/);
});

test('resolveGameCardCollectBadge_零或缺失不展示', () => {
  assert.equal(resolveGameCardCollectBadge({ like_count: 0 }), null);
  assert.equal(resolveGameCardCollectBadge({}), null);
  assert.equal(resolveGameCardCollectBadge({ favorite_count: 12, like_count: 1 }), '12人收藏');
});

test('resolveGameCardTags_无题材时不回落game_tags', () => {
  assert.deepEqual(resolveGameCardTags({ game_tags: 'CUSTOM' }), []);
  assert.deepEqual(resolveGameCardTags({ game_tags: '权谋,穿越' }), []);
  assert.deepEqual(resolveGameCardTags({ theme_tag_names: ['科幻'], game_tags: 'CUSTOM' }), ['科幻']);
});

test('resolveGameCardTags_应过滤引擎码避免与封面角标重复', () => {
  assert.deepEqual(resolveGameCardTags({ game_tags: 'CUSTOM' }), []);
  assert.deepEqual(resolveGameCardTags({ game_tags: 'TXT' }), []);
  assert.deepEqual(resolveGameCardTags({ game_tags: 'TXT,权谋' }), ['权谋']);
  assert.deepEqual(resolveGameCardTags({ theme_tag_names: ['CUSTOM', '都市现代', '全部'] }), ['都市现代']);
});

test('GameGrid_封面角标应使用下载切图火焰心形且正文含作者头像名称与标签', () => {
  const tsx = readFileSync(join(root, 'src/components/GameGrid.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/GameGrid.module.css'), 'utf8');
  const icons = readFileSync(join(root, 'src/components/GameCardStatIcons.tsx'), 'utf8');
  assert.match(tsx, /CardFlameIcon/);
  assert.match(tsx, /CardHeartIcon/);
  assert.match(icons, /icon_flame_pink\.webp/);
  assert.match(icons, /icon_heart\.webp/);
  assert.match(icons, /maskImage|WebkitMaskImage/);
  assert.match(tsx, /resolveGameCardBody/);
  assert.match(tsx, /resolveGameCardAuthor/);
  assert.match(tsx, /goodsMetaRow/);
  assert.match(tsx, /goodsCollectBadge/);
  assert.match(tsx, /goodsAuthor/);
  assert.match(tsx, /goodsAuthorAvatar/);
  assert.match(tsx, /goodsAuthorName/);
  assert.match(tsx, /goodsTagPill/);
  assert.doesNotMatch(tsx, /goodsTitleRow/);
  assert.doesNotMatch(tsx, /icon_flame\.webp|icon_heart\.svg/);
  assert.doesNotMatch(tsx, /goodsDesc/);
  assert.doesNotMatch(tsx, /body\.subtitle/);
  assert.doesNotMatch(tsx, /icon_download\.webp|AiOutlineLike|IoGameControllerOutline/);
  assert.ok(existsSync(join(root, 'public/data/assetsv2/home/icon_flame_pink.webp')));
  assert.ok(existsSync(join(root, 'public/data/assetsv2/home/icon_heart.webp')));
  assert.match(css, /\.goodsInfoFlame[\s\S]*height:\s*20\.16px/);
  assert.match(css, /\.goodsInfoHeart[\s\S]*height:\s*15\.12px/);
  assert.match(css, /\.goodsInfoItem[\s\S]*font-size:\s*13\.2px/);
  assert.match(css, /\.goodsCard[\s\S]*background:\s*#1C1C1E/);
  assert.match(css, /\.goodsCard[\s\S]*border-radius:\s*16px/);
  assert.match(css, /\.goodsImgPlaceholder/);
  assert.doesNotMatch(tsx, /welcome\.png/);
  assert.match(css, /\.goodsMetaRow[\s\S]*justify-content:\s*space-between/);
  assert.match(css, /\.goodsMetaRow[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.goodsCollectBadge[\s\S]*margin-left:\s*auto/);
  assert.match(css, /\.goodsCollectBadge[\s\S]*background:\s*#a8283c/i);
  assert.match(css, /\.goodsCollectBadge[\s\S]*color:\s*#ffffff/i);
  assert.match(css, /\.goodsAuthorAvatar[\s\S]*border-radius:\s*50%/);
  assert.match(css, /\.goodsTagPill[\s\S]*background:\s*#333333/);
  assert.match(css, /\.goodsTagPill[\s\S]*border-radius:\s*6px/);
  assert.match(css, /\.goodsTagPill[\s\S]*color:\s*#FFFFFF/);
  assert.match(css, /\.goodsTagPill[\s\S]*min-height:\s*24px/);
  assert.doesNotMatch(css, /\.goodsTagPill[\s\S]*border-radius:\s*999px/);
  assert.doesNotMatch(css, /\.goodsCollectBadge[\s\S]*#FFB6C1/);
  assert.doesNotMatch(css, /\.goodsCollectBadge[\s\S]*rgba\(168,\s*40,\s*60,\s*0\.38\)/);
});

test('HomeThemePreviewRail_封面底栏应使用下载切图火焰心形', () => {
  const tsx = readFileSync(join(root, 'src/components/HomeThemePreviewRail.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/HomeThemePreviewRail.module.css'), 'utf8');
  assert.match(tsx, /CardFlameIcon/);
  assert.match(tsx, /CardHeartIcon/);
  assert.match(tsx, /coverBottomMeta/);
  assert.doesNotMatch(tsx, /icon_flame\.webp|icon_heart\.svg|AiOutlineLike|IoGameControllerOutline/);
  assert.match(css, /\.statFlame[\s\S]*height:\s*15px/);
  assert.match(css, /\.statHeart[\s\S]*height:\s*11px/);
  assert.match(css, /\.statFlame[\s\S]*width:\s*11px/);
  assert.match(css, /\.statHeart[\s\S]*width:\s*13px/);
  assert.match(css, /\.statsRow[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.themeBadge,\s*\n\s*\.typeTag\s*\{[^}]*border:\s*none/);
  assert.match(css, /\.themeBadge\s*\{[^}]*box-shadow:\s*none/);
  assert.doesNotMatch(css, /\.themeBadge\s*\{[^}]*box-shadow:\s*inset/);
  assert.match(css, /\.statItem\s*\{[^}]*border:\s*none/);
  assert.match(css, /\.statItem\s*\{[^}]*box-shadow:\s*none/);
  assert.doesNotMatch(css, /\.statItem\s*\{[^}]*box-shadow:\s*inset/);
  /* 标题横向单行，禁止竖排断字 */
  assert.match(css, /\.title\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.coverBottomRow[\s\S]*flex-direction:\s*column/);
  assert.doesNotMatch(css, /\.title\s*\{[^}]*-webkit-line-clamp:\s*2/);
});
