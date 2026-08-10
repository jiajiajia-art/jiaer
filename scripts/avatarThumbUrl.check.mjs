/**
 * avatarThumbUrl 推导单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAvatarThumbUrl,
  isAvatarThumbUrl,
  pickDisplayAvatarFullUrl,
  pickDisplayAvatarThumbUrl,
} from '../src/lib/galgame/avatarThumbUrl.ts';

test('deriveAvatarThumbUrl_png变_150webp', () => {
  assert.equal(
    deriveAvatarThumbUrl('/api/visual/images/x/npcs/a/base_1_abc.png'),
    '/api/visual/images/x/npcs/a/base_1_abc_150.webp',
  );
  assert.equal(
    deriveAvatarThumbUrl('https://api-test2.kurangames.com/api/visual/images/x/players/base.png'),
    'https://api-test2.kurangames.com/api/visual/images/x/players/base_150.webp',
  );
});

test('pickDisplayAvatarThumbUrl_不回落png', () => {
  const u = pickDisplayAvatarThumbUrl([
    '',
    '/api/visual/images/x/npcs/a/base.png',
  ]);
  assert.equal(u, '/api/visual/images/x/npcs/a/base_150.webp');
  assert.equal(isAvatarThumbUrl(u), true);
  assert.doesNotMatch(u, /\.png$/i);
});

test('pickDisplayAvatarFullUrl_跳过150用原图', () => {
  const u = pickDisplayAvatarFullUrl([
    '/sessions/x/avatars/player_1_150.webp',
    '/sessions/x/avatars/player_1.png',
  ]);
  assert.equal(u, '/sessions/x/avatars/player_1.png');
});

test('pickDisplayAvatarFullUrl_局内仅有150时反推webp', () => {
  assert.equal(
    pickDisplayAvatarFullUrl([
      '/public/visual/sessions/s1/avatars/player_1706345143078_150.webp',
    ]),
    '/public/visual/sessions/s1/avatars/player_1706345143078.webp',
  );
  // 文档 NPC 路径不瞎猜
  assert.equal(
    pickDisplayAvatarFullUrl(['/api/visual/images/x/npcs/a/base_150.webp']),
    '',
  );
});
