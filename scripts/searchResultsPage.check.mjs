/**
 * 搜索结果页：三页签组织、全部区块上限、空状态、沿用作品卡/用户卡、提交进 /search。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('SearchPage_三页签与全部区块查看更多', () => {
  const page = readFileSync(join(root, 'src/page/Search.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/page/Search.module.css'), 'utf8');
  assert.match(page, /tabAll|全部/);
  assert.match(page, /'all' \| 'games' \| 'creators'/);
  assert.match(page, /relatedCreators/);
  assert.match(page, /relatedGames/);
  assert.match(page, /viewMore/);
  assert.match(page, /setTab\('creators'\)/);
  assert.match(page, /setTab\('games'\)/);
  assert.match(page, /PREVIEW_LIMIT = 4/);
  assert.match(page, /GameGrid/);
  assert.match(page, /SearchUserCard/);
  assert.match(page, /noRelatedContent/);
  assert.match(page, /tryOtherKeywords/);
  assert.match(page, /data-search-empty/);
  assert.doesNotMatch(page, /启星者|Lv\.0|金色/);
  assert.doesNotMatch(css, /#D4B07B|gold/i);
  assert.match(css, /#a8283c/);
});

test('Navbar_提交搜索应进入结果页', () => {
  const nav = readFileSync(join(root, 'src/components/Layout/Navbar.tsx'), 'utf8');
  assert.match(nav, /\/search\?q=/);
  assert.doesNotMatch(
    nav.slice(nav.indexOf('handleSearchSubmit'), nav.indexOf('handleSearchSubmit') + 500),
    /handleSearchSelect\(firstResult\)/,
  );
});

test('App_应注册search路由', () => {
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/search"/);
  assert.match(app, /SearchPage/);
});

test('SearchUserCard_无等级称号只有关注与计数', () => {
  const card = readFileSync(join(root, 'src/components/SearchUserCard.tsx'), 'utf8');
  assert.match(card, /worksCount/);
  assert.match(card, /followersCount/);
  assert.match(card, /followBtn/);
  assert.doesNotMatch(card, /Lv\.|启星者/);
  assert.doesNotMatch(card, /titleBadge|levelBadge/);
});

test('i18n_搜索空状态文案', () => {
  const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');
  assert.match(zh, /未找到相关内容/);
  assert.match(zh, /请尝试其他关键词/);
  assert.match(zh, /相关作者/);
  assert.match(zh, /相关游戏/);
});
