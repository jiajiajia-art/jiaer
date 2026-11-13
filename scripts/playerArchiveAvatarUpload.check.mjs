/**
 * 我的档案：生成头像可改提示词；上传仅 WebP≤1MB（优先质量100）、不做背景处理
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
  isAllowedPlayerAvatarUploadMime,
} from '../src/lib/galgame/compressImageToWebp.ts';
import {
  buildPlayerArchiveAvatarBasePrompt,
} from '../src/lib/galgame/sessionNpcAvatarPrompt.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const archiveSrc = readFileSync(
  join(root, 'src/components/Galgame/panels/PlayerArchiveSection.tsx'),
  'utf8',
);
const jobSrc = readFileSync(join(root, 'src/lib/galgame/playerAvatarBackgroundJob.ts'), 'utf8');
const apiSrc = readFileSync(join(root, 'src/api/galgame/playerCharacterCards.ts'), 'utf8');
const compressSrc = readFileSync(join(root, 'src/lib/galgame/compressImageToWebp.ts'), 'utf8');

test('compress_constants_1MB_quality100_webp', () => {
  assert.equal(PLAYER_UPLOAD_AVATAR_MAX_BYTES, 1024 * 1024);
  assert.equal(PLAYER_UPLOAD_AVATAR_QUALITY, 1);
  assert.equal(PLAYER_UPLOAD_AVATAR_FORMAT, 'webp');
  assert.equal(isAllowedPlayerAvatarUploadMime('image/png'), true);
  assert.equal(isAllowedPlayerAvatarUploadMime('image/svg+xml'), false);
  assert.equal(isAllowedPlayerAvatarUploadMime('application/pdf'), false);
});

test('compressImageToWebp_source_forbids_background_removal', () => {
  assert.doesNotMatch(compressSrc, /rembg\s*\(|removeBackground\s*\(|matteCharacterPortrait\s*\(/i);
  assert.match(compressSrc, /禁止调用任何抠图/);
  assert.match(compressSrc, /image\/webp/);
  assert.match(compressSrc, /PLAYER_UPLOAD_AVATAR_MAX_BYTES = 1024 \* 1024/);
  assert.match(compressSrc, /PLAYER_UPLOAD_AVATAR_QUALITY = 1/);
  assert.match(compressSrc, /优先质量 100/);
});

test('buildPlayerArchiveAvatarBasePrompt_对齐后端主角映射', () => {
  const prompt = buildPlayerArchiveAvatarBasePrompt({
    name: '沈清沅',
    gender: 'female',
    persona: '江南世家嫡女，心怀天下',
  });
  assert.match(prompt, /Name: 沈清沅/);
  assert.match(prompt, /Gender: female/);
  assert.match(prompt, /Create a single full-body character sprite/i);
  assert.match(prompt, /Negative prompt:/i);
  assert.match(prompt, /Appearance and role: 江南世家嫡女/);
  assert.match(prompt, /Relationship to player: 主角/);
  assert.doesNotMatch(prompt, /User style notes/);
});

test('PlayerArchiveSection_确认弹窗有风格选择与外貌补充_无英文只读底稿', () => {
  assert.match(archiveSrc, /画风与提示词/);
  assert.match(archiveSrc, /风格选择/);
  assert.match(archiveSrc, /外貌补充（可选）/);
  assert.match(archiveSrc, /AVATAR_STYLE_OPTIONS/);
  assert.match(archiveSrc, /avatarStyle/);
  assert.match(archiveSrc, /promptSupplement/);
  assert.match(archiveSrc, /确认生成头像/);
  // 扣费改为按后端实时价格展示（avatarChargeText），不再写死常量
  assert.match(archiveSrc, /将扣除 \$\{[^}]*avatarChargeText\} 生成 AI 头像/);
  assert.doesNotMatch(archiveSrc, /当前提示词/);
  assert.doesNotMatch(archiveSrc, /补充描述/);
  assert.doesNotMatch(archiveSrc, /promptCueReadonly/);
  assert.doesNotMatch(archiveSrc, /buildPlayerArchiveAvatarBasePrompt/);
});

test('PlayerArchiveSection_支持上传图片入口', () => {
  assert.match(archiveSrc, /上传图片/);
  assert.match(archiveSrc, /compressImageFileToWebpUnderMaxBytes/);
  assert.match(archiveSrc, /uploadPlayerAvatar/);
  assert.match(archiveSrc, /PLAYER_UPLOAD_AVATAR_MAX_BYTES/);
  assert.match(archiveSrc, /≤1MB|1MB/);
  assert.match(archiveSrc, /不做背景处理/);
});

test('playerAvatarBackgroundJob_payload含promptSupplement', () => {
  assert.match(jobSrc, /promptSupplement\?:/);
});

test('api_uploadPlayerAvatar_走upload路由', () => {
  assert.match(apiSrc, /player-avatar\/upload/);
  assert.match(apiSrc, /uploadPlayerAvatar/);
  assert.match(apiSrc, /FormData/);
});
