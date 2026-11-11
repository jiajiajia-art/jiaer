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

test('resolvePlayPortraitScale_导入卡0_8_重生成1_禁止吃陈旧msgScale', async () => {
  const {
    resolvePlayPortraitScale,
    SESSION_OVERRIDE_PORTRAIT_SCALE,
    SESSION_GENERATED_PORTRAIT_SCALE,
    isImportedCardPortraitUrl,
    isSessionGeneratedPortraitUrl,
  } = await import('../src/lib/galgame/playerCharacterCard.ts');
  assert.equal(SESSION_OVERRIDE_PORTRAIT_SCALE, 0.8);
  assert.equal(SESSION_GENERATED_PORTRAIT_SCALE, 1);
  assert.equal(
    isImportedCardPortraitUrl('/public/visual/player-cards/u1/avatars/a.webp'),
    true,
  );
  assert.equal(
    isImportedCardPortraitUrl('/public/visual/sessions/s1/avatars/player_1.webp'),
    false,
  );
  assert.equal(
    isSessionGeneratedPortraitUrl('/public/visual/sessions/s1/avatars/player_1.webp'),
    true,
  );
  assert.equal(
    isSessionGeneratedPortraitUrl('/public/visual/player-cards/u1/avatars/a.webp'),
    false,
  );
  assert.equal(
    resolvePlayPortraitScale({
      sessionAvatarUrl: '/public/visual/player-cards/u1/avatars/a.webp',
      documentPortraitScale: 1.2,
    }),
    0.8,
  );
  assert.equal(
    resolvePlayPortraitScale({
      sessionAvatarUrl: '/public/visual/sessions/s1/avatars/player_1.webp',
      documentPortraitScale: 1.2,
    }),
    1,
    '局内重新生成须 1，与文档立绘同级，禁止再缩成小人',
  );
  assert.equal(
    resolvePlayPortraitScale({
      sessionAvatarUrl: '/public/visual/sessions/6492c8acaead61589e585d44a850a2d2/avatars/player_1786799862082.webp',
      documentPortraitScale: 0.8,
    }),
    1,
    '导入后 Message 上残留 0.8 时，重生成仍须回到 1',
  );
  assert.equal(
    resolvePlayPortraitScale({
      sessionAvatarUrl: '/public/visual/sessions/s1/avatars/player_upload_99.webp',
      documentPortraitScale: 0.8,
    }),
    1,
    '用户上传立绘须 1，避免再缩小发糊',
  );
  assert.equal(
    resolvePlayPortraitScale({ sessionAvatarUrl: '', documentPortraitScale: 1.2 }),
    1.2,
  );
  assert.equal(
    resolvePlayPortraitScale({ sessionAvatarUrl: null, documentPortraitScale: undefined }),
    undefined,
  );
});

test('Galgame_主角缩放须用文档portraitScale禁止msg残留', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /resolveSessionPlayerPortraitPath/);
  assert.match(src, /resolvePlayPortraitScale/);
  assert.match(
    src,
    /documentPortraitScale:\s*controller\.presetData\?\.world\?\.player\?\.portraitScale/,
  );
  assert.doesNotMatch(
    src,
    /documentPortraitScale:\s*msg\.portraitScale/,
    '禁止把 Message 已解析的 scale 当文档缩放，否则重生成仍 0.8',
  );
  assert.match(src, /sessionPlayerAvatarUrl:\s*sessionPlayerProfile\?\.avatarUrl/);
  assert.match(
    src,
    /normalModeMessage\?\.characterImage\s*\|\|\s*controller\.rawBridgePortrait\?\.characterImage/,
    '主线立绘层须优先吃局内覆盖后的 normalModeMessage，并允许 Aliyun raw bridge 立绘兜底',
  );
  assert.doesNotMatch(
    src,
    /characterImage=\{controller\.currentMessage\.characterImage\}/,
  );
});
