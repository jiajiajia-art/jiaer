/**
 * 主线立绘：局内档案头像优先于文档原图
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionPlayerPortraitPath } from '../src/lib/galgame/playerCharacterCard.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('resolveSessionPlayerPortraitPath_局内头像优先', () => {
  assert.equal(
    resolveSessionPlayerPortraitPath(
      { avatarUrl: '/public/visual/sessions/s1/avatars/player_1.png' },
      { images: { base: '/api/visual/images/x/players/base.png' } },
    ),
    '/public/visual/sessions/s1/avatars/player_1.png',
  );
});

test('resolveSessionPlayerPortraitPath_无局内头像回落文档', () => {
  assert.equal(
    resolveSessionPlayerPortraitPath(
      { avatarUrl: '' },
      { images: { base: '/api/visual/images/x/players/base.png' } },
    ),
    '/api/visual/images/x/players/base.png',
  );
});

test('Galgame_CharacterLayer用normalModeMessage立绘', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /resolveSessionPlayerPortraitPath/);
  assert.match(src, /sessionPlayerAvatarUrl:\s*sessionPlayerProfile\?\.avatarUrl/);
  assert.match(
    src,
    /characterImage=\{normalModeMessage\.characterImage\}/,
    '主线立绘层须吃局内覆盖后的 normalModeMessage，禁止仍用 controller 原图',
  );
  assert.doesNotMatch(
    src,
    /characterImage=\{controller\.currentMessage\.characterImage\}/,
  );
});
