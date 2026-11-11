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
  pickFormAvatarDockUrl,
  firstUploadedPortraitFullUrl,
  isAvatarThumbForSource,
  collectConfirmedAvatarThumbs,
  hasConfirmedAvatarThumb,
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
    '已有确认 150 时 pending 也立刻显示',
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

test('pickAvatarListDisplayUrl_用户上传跳过头顶150用原图', () => {
  const full = '/public/visual/sessions/s1/avatars/chen_mo_upload_1787.webp';
  const thumb = '/public/visual/sessions/s1/avatars/chen_mo_upload_1787_150.webp';
  assert.equal(firstUploadedPortraitFullUrl([thumb, full]), full);
  assert.equal(
    pickAvatarListDisplayUrl([thumb, full], { pendingThumbs: true }),
    full,
    '上传图即使 pending 也必须立刻用原图，禁止头顶裁切小图',
  );
  assert.equal(pickAvatarDisplayUrl([thumb, full]), full);
  assert.equal(
    pickFormAvatarDockUrl({
      formAvatarUrl: full,
      formAvatarThumbUrl: thumb,
      sessionAvatarThumbUrl: thumb,
      initialAvatarUrl: full,
    }),
    full,
  );
});

test('collectConfirmedAvatarThumbs_只收集确认150', () => {
  assert.deepEqual(
    collectConfirmedAvatarThumbs([
      { id: 'a', avatarThumbUrl: '/x/a_150.webp' },
      { id: 'b', avatarThumbUrl: '/x/b.png' },
      { id: 'c', avatarThumbUrl: '' },
      { id: 'a', avatarThumbUrl: '/x/a_other_150.webp' },
    ]),
    { a: '/x/a_150.webp' },
  );
});

test('hasConfirmedAvatarThumb_识别150', () => {
  assert.equal(hasConfirmedAvatarThumb(['', '/x/a.png']), false);
  assert.equal(hasConfirmedAvatarThumb(['/x/a_150.webp', '/x/a.png']), true);
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

test('isAvatarThumbForSource_换立绘后旧150不匹配', () => {
  assert.equal(
    isAvatarThumbForSource(
      '/public/visual/sessions/s1/avatars/old_150.webp',
      '/public/visual/sessions/s1/avatars/old.webp',
    ),
    true,
  );
  assert.equal(
    isAvatarThumbForSource(
      '/api/visual/images/x/npcs/a/base_150.webp',
      '/public/visual/sessions/s1/avatars/new_999.webp',
    ),
    false,
  );
});

test('pickFormAvatarDockUrl_新生成立绘不得被父级旧150盖住', () => {
  const staleThumb = '/public/visual/sessions/s1/avatars/old_150.webp';
  const nextFull = '/public/visual/sessions/s1/avatars/new_999.webp';
  const nextThumb = '/public/visual/sessions/s1/avatars/new_999_150.webp';
  assert.equal(
    pickFormAvatarDockUrl({
      formAvatarThumbUrl: nextThumb,
      formAvatarUrl: nextFull,
      sessionAvatarThumbUrl: staleThumb,
      initialAvatarUrl: '/public/visual/sessions/s1/avatars/old.webp',
    }),
    nextThumb,
  );
  assert.equal(
    pickFormAvatarDockUrl({
      formAvatarThumbUrl: '',
      formAvatarUrl: nextFull,
      sessionAvatarThumbUrl: staleThumb,
      initialAvatarUrl: '/public/visual/sessions/s1/avatars/old.webp',
    }),
    nextFull,
    '新原图尚未有 150 时也要用新图，禁止回落旧 150',
  );
  assert.equal(
    pickFormAvatarDockUrl({
      formAvatarThumbUrl: '',
      formAvatarUrl: '/public/visual/sessions/s1/avatars/old.webp',
      sessionAvatarThumbUrl: staleThumb,
      initialAvatarUrl: '/public/visual/sessions/s1/avatars/old.webp',
    }),
    staleThumb,
    '未重新生成时仍用父级确认 150',
  );
  assert.equal(
    pickFormAvatarDockUrl({
      formAvatarThumbUrl: '',
      formAvatarUrl: '/api/visual/images/x/npcs/wang/base.png',
      sessionAvatarThumbUrl: '',
      initialAvatarUrl: '/api/visual/images/x/npcs/wang/base.png',
    }),
    '/api/visual/images/x/npcs/wang/base.png',
    '详情已有文档原图时编辑坞必须带回，不能空占位',
  );
  assert.equal(
    pickFormAvatarDockUrl({
      formAvatarThumbUrl: '',
      formAvatarUrl: '/api/visual/images/x/npcs/wang/base.png',
      sessionAvatarThumbUrl: '/public/visual/sessions/s1/avatars/old_150.webp',
      initialAvatarUrl: '/api/visual/images/x/npcs/wang/base.png',
    }),
    '/api/visual/images/x/npcs/wang/base.png',
    '不匹配当前原图的旧 150 不得挡住文档头像',
  );
});

test('CharacterProfileForm_编辑人设坞用展示选择器', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/components/Galgame/panels/CharacterProfileForm.tsx'), 'utf8');
  assert.match(src, /pickFormAvatarDockUrl/, '编辑人设头像坞须用表单优先选择器');
  assert.match(src, /sessionAvatarThumbUrl/, '须接入会话侧 ensure 的角色 150');
  assert.match(src, /const dockSrc = avatarThumbSrc \|\| avatarFullSrc/, '坞须带回原图，避免空占位');
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
  assert.match(src, /isAvatarThumbForSource/);
  assert.match(src, /pickPreferredNpcAvatarFields/);
  assert.match(src, /isSessionGeneratedPortraitUrl\(full\) \? '' : \(preset\?\.avatarUrl/);
  assert.match(src, /collectConfirmedAvatarThumbs/);
  assert.match(src, /hasConfirmedAvatarThumb/);
  assert.match(src, /isAvatarSlotPending/);
  assert.match(src, /AvatarThumbSlot/);
  assert.match(src, /avatarLoading|detailPortraitLoading/);
  assert.match(src, /已有确认小图先播种立即显示/);
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
