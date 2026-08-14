/**
 * avatarThumbUrl 推导单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAvatarThumbUrl,
  isAvatarThumbUrl,
  pickAvatarDisplayUrl,
  pickAvatarListDisplayUrl,
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

test('pickDisplayAvatarThumbUrl_不臆造未ensure的150', () => {
  assert.equal(
    pickDisplayAvatarThumbUrl([
      '',
      '/api/visual/images/x/npcs/a/base.png',
    ]),
    '',
    '仅有 PNG 时不得返回臆造的 *_150.webp',
  );
  assert.equal(
    pickDisplayAvatarThumbUrl([
      '/api/visual/images/x/npcs/a/base_150.webp',
      '/api/visual/images/x/npcs/a/base.png',
    ]),
    '/api/visual/images/x/npcs/a/base_150.webp',
  );
});

test('pickAvatarDisplayUrl_无150回落原图', () => {
  const u = pickAvatarDisplayUrl([
    '',
    '/api/visual/images/x/npcs/a/base.png',
  ]);
  assert.equal(u, '/api/visual/images/x/npcs/a/base.png');
  assert.equal(isAvatarThumbUrl(u), false);
});

test('pickAvatarDisplayUrl_有150优先小图', () => {
  assert.equal(
    pickAvatarDisplayUrl([
      '/api/visual/images/x/npcs/a/base_150.webp',
      '/api/visual/images/x/npcs/a/base.png',
    ]),
    '/api/visual/images/x/npcs/a/base_150.webp',
  );
});

test('pickAvatarListDisplayUrl_pending时不回落原图', () => {
  assert.equal(
    pickAvatarListDisplayUrl(
      ['', '/api/visual/images/x/npcs/a/base.png'],
      { pendingThumbs: true },
    ),
    '',
    '等待 ensure 时禁止先出大图',
  );
  assert.equal(
    pickAvatarListDisplayUrl(
      [
        '/api/visual/images/x/npcs/a/base_150.webp',
        '/api/visual/images/x/npcs/a/base.png',
      ],
      { pendingThumbs: true },
    ),
    '/api/visual/images/x/npcs/a/base_150.webp',
  );
  assert.equal(
    pickAvatarListDisplayUrl(
      ['', '/api/visual/images/x/npcs/a/base.png'],
      { pendingThumbs: false },
    ),
    '/api/visual/images/x/npcs/a/base.png',
    'ensure 结束后仍无小图才允许原图',
  );
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

test('CharacterProfileForm_编辑人设坞用展示选择器', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/components/Galgame/panels/CharacterProfileForm.tsx'), 'utf8');
  assert.match(src, /pickDisplayAvatarThumbUrl/, '编辑人设头像坞须只用确认 150');
  assert.match(src, /sessionAvatarThumbUrl/, '须接入会话侧 ensure 的角色 150');
  assert.doesNotMatch(
    src,
    /const avatarSrc = getImageUrl\(values\.avatarUrl\)/,
    '禁止表单坞直接吃 avatarUrl 原图',
  );
});

test('CharactersPanel_列表pending不回落原图', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/components/Galgame/panels/CharactersPanel.tsx'), 'utf8');
  assert.match(src, /pickAvatarListDisplayUrl/);
  assert.match(src, /pendingThumbs:\s*avatarThumbsPending/);
  assert.match(src, /AvatarThumbSlot/);
  assert.match(src, /avatarLoading|detailPortraitLoading/);
});

test('PlayPanelShell_头像loading样式存在', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(dir, '../src/components/Galgame/panels/PlayPanelShell.module.css'), 'utf8');
  assert.match(css, /\.avatarLoading\b/);
  assert.match(css, /avatarInkSweep/);
  assert.match(css, /prefers-reduced-motion/);
});
