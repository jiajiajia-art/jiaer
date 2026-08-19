/**
 * 局内编辑人设 / 添加角色：自定义上传立绘，样式对齐「我的档案」
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLAYER_UPLOAD_AVATAR_FORMAT,
  PLAYER_UPLOAD_AVATAR_MAX_BYTES,
  PLAYER_UPLOAD_AVATAR_QUALITY,
} from '../src/lib/galgame/compressImageToWebp.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const formSrc = readFileSync(
  join(root, 'src/components/Galgame/panels/CharacterProfileForm.tsx'),
  'utf8',
);
const css = readFileSync(
  join(root, 'src/components/Galgame/panels/CharacterProfileForm.module.css'),
  'utf8',
);
const apiSrc = readFileSync(
  join(root, 'src/api/galgame/playerCharacterCards.ts'),
  'utf8',
);

test('CharacterProfileForm_编辑与添加共用上传入口', () => {
  assert.match(formSrc, /上传图片/);
  assert.match(formSrc, /compressImageFileToWebpUnderMaxBytes/);
  assert.match(formSrc, /uploadNpcAvatar/);
  assert.match(formSrc, /PLAYER_UPLOAD_AVATAR_MAX_BYTES/);
  assert.match(formSrc, /PLAYER_UPLOAD_AVATAR_ACCEPT/);
  assert.match(formSrc, /avatarUploadBtn/);
  assert.match(formSrc, /≤1MB/);
  assert.match(formSrc, /转 WebP/);
  assert.doesNotMatch(formSrc, /window\.alert|window\.confirm/);
  assert.doesNotMatch(formSrc, /点击头像可放大预览/);
  assert.doesNotMatch(formSrc, /reqLabel\('头像'/);
});

test('CharacterProfileForm_上传头像须contain禁止cover裁切', () => {
  assert.match(formSrc, /isSessionUploadedPortraitUrl/);
  assert.match(formSrc, /avatarImgPoster/);
  assert.match(formSrc, /previewPortraitPoster/);
  assert.match(css, /\.avatarImgPoster\s*\{/);
  const poster = css.match(/\.avatarImgPoster\s*\{[^}]+\}/)?.[0] || '';
  assert.match(poster, /object-fit:\s*contain/);
  assert.doesNotMatch(poster, /object-fit:\s*cover/);
  const panelCss = readFileSync(
    join(root, 'src/components/Galgame/panels/PlayPanelShell.module.css'),
    'utf8',
  );
  const previewPoster = panelCss.match(/\.avatarPreviewPortraitPoster\s*\{[^}]+\}/)?.[0] || '';
  assert.match(previewPoster, /object-fit:\s*contain/);
  const listSrc = readFileSync(
    join(root, 'src/components/Galgame/panels/CharactersPanel.tsx'),
    'utf8',
  );
  assert.match(listSrc, /letterbox=\{isSessionUploadedPortraitUrl/);
  assert.match(listSrc, /avatarPreviewPortraitPoster/);
});

test('CharacterProfileForm_上传按钮样式对齐我的档案', () => {
  assert.match(css, /\.avatarActionRow\s*\{/);
  assert.match(css, /\.avatarUploadBtn\s*\{/);
  assert.match(css, /\.hiddenFileInput\s*\{/);
  assert.match(css, /flex-direction:\s*column/);
});

test('api_uploadNpcAvatar_走npc-avatar_upload', () => {
  assert.match(apiSrc, /npc-avatar\/upload/);
  assert.match(apiSrc, /uploadNpcAvatar/);
  assert.match(apiSrc, /form\.append\('npcId'/);
  assert.equal(PLAYER_UPLOAD_AVATAR_MAX_BYTES, 1024 * 1024);
  assert.equal(PLAYER_UPLOAD_AVATAR_QUALITY, 1);
  assert.equal(PLAYER_UPLOAD_AVATAR_FORMAT, 'webp');
});
