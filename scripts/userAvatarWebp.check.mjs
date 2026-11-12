/**
 * 功能注释：用户头像展示统一 ?format=webp；禁止臆造 _150.webp 路径。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preferUserAvatarWebp } from '../src/utils/userAvatarUrl.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('preferUserAvatarWebp_给头像加format', () => {
  assert.equal(
    preferUserAvatarWebp('/interactive-fiction-game-avatar/u/a.png'),
    '/interactive-fiction-game-avatar/u/a.png?format=webp',
  );
  assert.equal(
    preferUserAvatarWebp('http://gogo.kurangames.cn/interactive-fiction-game-avatar/u/a.png'),
    'http://gogo.kurangames.cn/interactive-fiction-game-avatar/u/a.png?format=webp',
  );
});

test('preferUserAvatarWebp_已有format或webp不重复', () => {
  assert.equal(
    preferUserAvatarWebp('/interactive-fiction-game-avatar/u/a.png?format=webp'),
    '/interactive-fiction-game-avatar/u/a.png?format=webp',
  );
  assert.equal(
    preferUserAvatarWebp('/interactive-fiction-game-avatar/u/a_150.webp'),
    '/interactive-fiction-game-avatar/u/a_150.webp',
  );
});

test('preferUserAvatarWebp_非头像路径不动', () => {
  assert.equal(preferUserAvatarWebp('/public/visual/x.png'), '/public/visual/x.png');
  assert.equal(preferUserAvatarWebp(''), '');
});

test('getImageUrl_须经preferUserAvatarWebp且禁止臆造_150路径', () => {
  const src = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(src, /preferUserAvatarWebp/);
  assert.doesNotMatch(src, /_150\.webp/);
});

test('Navbar_不再手写叠加format=webp', () => {
  const nav = readFileSync(join(root, 'src/components/Layout/Navbar.tsx'), 'utf8');
  // 功能注释：允许注释提到 format=webp；禁止再拼接查询参数
  assert.doesNotMatch(nav, /\$\{sep\}format=webp|['"`]\?format=webp|['"`]&format=webp/);
  assert.match(nav, /getImageUrl\(user\?\.user\?\.avatarUrl\)/);
});
