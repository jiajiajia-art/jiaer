/**
 * 属性面板导入人设卡：列表/预览须展示卡库立绘，不得只显示姓名首字；
 * 导入合并严禁残留旧 avatarThumbUrl（否则姓名已换、头像仍是旧人）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyPlayerCardImport,
  mergeProfileAfterPlayerCardImport,
  previewPlayerCardImportDiff,
} from '../src/lib/galgame/playerCharacterCard.ts';
import {
  pickAvatarDisplayUrl,
  pickDisplayAvatarFullUrl,
} from '../src/lib/galgame/avatarThumbUrl.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const archive = readFileSync(
  join(root, 'src/components/Galgame/panels/PlayerArchiveSection.tsx'),
  'utf8',
);
const beImport = readFileSync(
  join(root, '../Interactive-fiction-backend/interface/handlers/playerCharacterCards.js'),
  'utf8',
);

const CARD_AVATAR = '/public/visual/player-cards/u1/avatars/cixi.webp';
const OLD_THUMB = '/public/visual/sessions/s1/avatars/old_player_150.webp';
const OLD_FULL = '/public/visual/sessions/s1/avatars/old_player.webp';

function sampleCard(overrides = {}) {
  return {
    id: 'card_cixi',
    userId: 'u1',
    name: '慈禧',
    gender: 'female',
    persona: '身高168，留着棕色长卷发，紫色眼睛',
    attributes: {},
    avatarUrl: CARD_AVATAR,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

test('PlayerArchive_导入列表须渲染card.avatarUrl', () => {
  assert.match(archive, /card\.avatarUrl/);
  assert.match(archive, /importAvatarImg/);
  assert.match(archive, /cardAvatarSrc \? \(/);
  assert.match(archive, /TrimmedTransparentImg/);
  assert.match(archive, /variant="bust"/);
});

test('PlayerArchive_预览须展示立绘', () => {
  assert.match(archive, /previewAvatarWrap/);
  assert.match(archive, /previewAvatarSrc/);
  assert.match(archive, /带上卡库立绘/);
  assert.match(archive, /TrimmedTransparentImg[\s\S]*?variant="bust"/);
});

test('PlayerArchive_总览方框头像须bust裁切禁止整身cover', () => {
  assert.match(archive, /className=\{styles\.avatarImg\}[\s\S]*?variant="bust"/);
  assert.match(archive, /className=\{styles\.editAvatarImg\}[\s\S]*?variant="bust"/);
  assert.match(
    archive,
    /方框 bust 裁切必须用原图/,
  );
  assert.match(archive, /pickDisplayAvatarFullUrl/);
  assert.doesNotMatch(
    archive,
    /pickAvatarDisplayUrl\(\[\s*profile\?\.avatarThumbUrl/,
    '方框 bust 禁止优先 _150，否则裁成碎脸',
  );
  const css = readFileSync(
    join(root, 'src/components/Galgame/panels/PlayerArchiveSection.module.css'),
    'utf8',
  );
  const avatarImgBlock = css.match(/\.avatarImg\s*\{[^}]+\}/)?.[0] || '';
  const editAvatarImgBlock = css.match(/\.editAvatarImg\s*\{[^}]+\}/)?.[0] || '';
  assert.match(avatarImgBlock, /object-fit:\s*contain/);
  assert.match(avatarImgBlock, /object-position:\s*bottom center/);
  assert.doesNotMatch(avatarImgBlock, /object-fit:\s*cover/);
  assert.match(editAvatarImgBlock, /object-fit:\s*contain/);
  assert.doesNotMatch(editAvatarImgBlock, /object-fit:\s*cover/);
});

test('PlayerArchive_confirmImport必须走mergeProfileAfterPlayerCardImport', () => {
  assert.match(archive, /mergeProfileAfterPlayerCardImport/);
  const confirm = archive.match(/const confirmImport[\s\S]*?finally\s*\{[\s\S]*?setSaving\(false\);/)?.[0] || '';
  assert.match(confirm, /mergeProfileAfterPlayerCardImport/);
  assert.doesNotMatch(
    confirm,
    /previousProfile:\s*profile[\s\S]*avatarThumbUrl:\s*profile/,
    'confirmImport 不得把旧局 thumb 无条件塞回',
  );
  assert.doesNotMatch(
    confirm,
    /profile\?\.avatarThumbUrl \? \{ avatarThumbUrl: profile\.avatarThumbUrl \}/,
  );
});

test('applyPlayerCardImport_带上avatarUrl', () => {
  const ok = applyPlayerCardImport(sampleCard());
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.profile.avatarUrl, CARD_AVATAR);
  assert.equal(ok.profile.avatarNeedsRegen, false);
  assert.equal(ok.profile.name, '慈禧');
});

test('previewPlayerCardImportDiff_应标出avatar变化', () => {
  const diff = previewPlayerCardImportDiff(
    {
      name: '旧',
      gender: 'male',
      persona: 'x',
      customAttributes: {},
      avatarUrl: OLD_FULL,
      avatarThumbUrl: OLD_THUMB,
    },
    sampleCard(),
  );
  assert.equal(diff.ok, true);
  assert.ok(diff.changedKeys.includes('avatarUrl'));
  assert.ok(diff.changedKeys.includes('name'));
});

test('mergeProfileAfterPlayerCardImport_卡有立绘必须覆盖旧头像', () => {
  const applied = applyPlayerCardImport(sampleCard());
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const merged = mergeProfileAfterPlayerCardImport({
    applied: applied.profile,
    serverProfile: {
      name: '慈禧',
      gender: 'female',
      persona: applied.profile.persona,
      customAttributes: {},
      importedCardId: 'card_cixi',
      avatarUrl: CARD_AVATAR,
    },
    previousProfile: {
      name: '旧角',
      gender: 'female',
      persona: '旧人设',
      customAttributes: {},
      avatarUrl: OLD_FULL,
      avatarThumbUrl: OLD_THUMB,
    },
  });
  assert.equal(merged.avatarUrl, CARD_AVATAR);
  assert.equal(merged.name, '慈禧');
  assert.equal(
    merged.avatarThumbUrl,
    undefined,
    '换立绘后不得残留旧 150 小图',
  );
});

test('mergeProfileAfterPlayerCardImport_服务端漏avatar时仍用卡库立绘', () => {
  const applied = applyPlayerCardImport(sampleCard());
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const merged = mergeProfileAfterPlayerCardImport({
    applied: applied.profile,
    serverProfile: {
      name: '慈禧',
      gender: 'female',
      persona: 'x',
      customAttributes: {},
      importedCardId: 'card_cixi',
      // 故意不带 avatarUrl
    },
    previousProfile: {
      name: '旧角',
      gender: 'female',
      persona: '旧',
      customAttributes: {},
      avatarUrl: OLD_FULL,
      avatarThumbUrl: OLD_THUMB,
    },
  });
  assert.equal(merged.avatarUrl, CARD_AVATAR);
  assert.equal(merged.avatarThumbUrl, undefined);
});

test('mergeProfileAfterPlayerCardImport_旧thumb不得污染列表展示', () => {
  const applied = applyPlayerCardImport(sampleCard());
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const merged = mergeProfileAfterPlayerCardImport({
    applied: applied.profile,
    serverProfile: {
      name: '慈禧',
      gender: 'female',
      persona: applied.profile.persona,
      customAttributes: {},
      importedCardId: 'card_cixi',
      avatarUrl: CARD_AVATAR,
    },
    previousProfile: {
      name: '旧角',
      gender: 'female',
      persona: '旧',
      customAttributes: {},
      avatarUrl: OLD_FULL,
      avatarThumbUrl: OLD_THUMB,
    },
  });
  // 模拟 PlayerArchiveSection 列表选路：thumb 优先，无 thumb 回落原图
  const listSrc = pickAvatarDisplayUrl([
    merged.avatarThumbUrl,
    merged.avatarUrl,
    '/document/player.png',
  ]);
  const fullSrc = pickDisplayAvatarFullUrl([
    merged.avatarUrl,
    '/document/player.png',
    merged.avatarThumbUrl,
  ]);
  assert.equal(listSrc, CARD_AVATAR, '列表必须显示新卡立绘，不能是旧 thumb');
  assert.equal(fullSrc, CARD_AVATAR, '放大预览必须是新卡立绘');
  assert.notEqual(listSrc, OLD_THUMB);
  assert.notEqual(listSrc, OLD_FULL);
});

test('mergeProfileAfterPlayerCardImport_同图可保留thumb', () => {
  const applied = applyPlayerCardImport(sampleCard({
    avatarUrl: OLD_FULL,
    avatarThumbUrl: OLD_THUMB,
  }));
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const merged = mergeProfileAfterPlayerCardImport({
    applied: applied.profile,
    serverProfile: {
      name: '慈禧',
      gender: 'female',
      persona: 'x',
      customAttributes: {},
      importedCardId: 'card_cixi',
      avatarUrl: OLD_FULL,
      avatarThumbUrl: OLD_THUMB,
    },
    previousProfile: {
      name: '慈禧',
      gender: 'female',
      persona: 'x',
      customAttributes: {},
      avatarUrl: OLD_FULL,
      avatarThumbUrl: OLD_THUMB,
    },
  });
  assert.equal(merged.avatarUrl, OLD_FULL);
  assert.equal(merged.avatarThumbUrl, OLD_THUMB);
});

test('backend_import保留卡库立绘', () => {
  assert.match(beImport, /preserveIncomingAvatar/);
  assert.match(beImport, /imported\.profile\?\.avatarUrl/);
});
