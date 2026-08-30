/**
 * 推荐列表与官方精选轨：标题下均为作者头像 + 昵称。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GAME_CARD_DEFAULT_AVATAR_PATH,
  resolveGameCardAuthor,
} from '../src/lib/gameCardAuthor.ts';

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

test('GameGrid_推荐列表第二行应渲染作者byline而非描述或subtitle', () => {
  const tsx = readFileSync(join(root, 'src/components/GameGrid.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/GameGrid.module.css'), 'utf8');
  assert.match(tsx, /resolveGameCardAuthor/);
  assert.match(tsx, /goodsAuthor/);
  assert.match(tsx, /goodsAuthorAvatar/);
  assert.doesNotMatch(tsx, /meta\.subtitle/);
  assert.doesNotMatch(tsx, /resolveGameCardSecondaryText|goodsDesc/);
  assert.match(css, /\.goodsAuthorAvatar/);
  assert.match(css, /rgba\(224,\s*61,\s*75/);
  assert.doesNotMatch(css, /\.goodsDesc\b/);
});

test('HomeThemePreviewRail_封面底栏应渲染作者byline而非subtitle', () => {
  const tsx = readFileSync(join(root, 'src/components/HomeThemePreviewRail.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/HomeThemePreviewRail.module.css'), 'utf8');
  assert.match(tsx, /resolveGameCardAuthor/);
  assert.match(tsx, /styles\.author/);
  assert.match(tsx, /authorAvatar/);
  assert.doesNotMatch(tsx, /game\.subtitle/);
  assert.match(css, /\.authorAvatar/);
  assert.match(css, /rgba\(224,\s*61,\s*75/);
});
