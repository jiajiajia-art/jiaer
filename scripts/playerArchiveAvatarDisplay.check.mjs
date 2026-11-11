/**
 * 我的档案：头像展示与手动 AI 生成不跟换角 A/B；A/B 只管换角清头像
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(
  join(root, 'src/components/Galgame/panels/PlayerArchiveSection.tsx'),
  'utf8',
);
const beHandler = readFileSync(
  join(root, '../Interactive-fiction-backend/interface/handlers/visual/sessionPlayerProfiles.js'),
  'utf8',
);

test('PlayerArchive_总览档案卡是CrimsonDossier布局', () => {
  assert.match(src, /dossierHero/);
  assert.match(src, /dossierMeta/);
  assert.match(src, /identityName/);
  assert.match(src, /avatarZoomCue/);
  assert.match(src, /isSessionUploadedPortraitUrl/);
  assert.match(src, /avatarVariant/);
  assert.match(
    src,
    /isSessionUploadedPortraitUrl\(profile\?\.avatarUrl\) \? 'full' : 'bust'/,
  );
  assert.match(src, /variant=\{avatarVariant\}/);
});

test('PlayerArchive_大图预览须等比例完整显示禁止cover裁切', () => {
  assert.match(src, /avatarPreviewStage/);
  const css = readFileSync(
    join(root, 'src/components/Galgame/panels/PlayerArchiveSection.module.css'),
    'utf8',
  );
  const imgBlock = css.match(/\.avatarPreviewImg\s*\{[^}]+\}/)?.[0] || '';
  assert.match(imgBlock, /object-fit:\s*contain/);
  assert.match(imgBlock, /max-height:\s*min\(/);
  assert.doesNotMatch(imgBlock, /object-fit:\s*cover/);
  assert.doesNotMatch(imgBlock, /aspect-ratio:\s*1(?!\s*\/)/);
});

test('PlayerArchive_总览始终有生成头像按钮', () => {
  assert.match(src, /头像与「生成头像」始终可见/);
  assert.match(src, /className=\{styles\.avatarGenBtn\}/);
  assert.doesNotMatch(
    src,
    /\{playerAvatarAbOnChange \? \(\s*<button[\s\S]*?avatarGenBtn/,
    '生成按钮不得再包在 A/B 条件里',
  );
  assert.doesNotMatch(src, /if \(!playerAvatarAbOnChange\) return;/);
});

test('PlayerArchive_生成头像确认含提示词补充_对齐添加角色', () => {
  assert.match(src, /画风与提示词/);
  assert.match(src, /avatarPromptSupplement/);
  assert.match(src, /avatarStyleId/);
  assert.match(src, /AVATAR_STYLE_OPTIONS/);
  assert.match(src, /风格选择/);
  assert.match(src, /外貌补充（可选）/);
  assert.match(src, /renderAvatarConfirmModal/);
  assert.doesNotMatch(src, /当前提示词/);
  assert.doesNotMatch(src, /补充描述/);
});

test('PlayerArchive_支持用户上传头像_不抠图', () => {
  assert.match(src, /上传图片/);
  assert.match(src, /compressImageFileToWebpUnderMaxBytes/);
  assert.match(src, /uploadPlayerAvatar/);
});

test('PlayerArchive_编辑页始终有AI生成', () => {
  assert.match(src, /手动 AI 生成始终可用/);
  assert.match(src, /编辑页头像舞台对齐总览 Crimson Dossier/);
  assert.match(src, /editAvatarBlock/);
  assert.match(src, /editAvatarTitle/);
  assert.match(src, /className=\{styles\.avatarGenBtn\}/);
  const editSlice = src.match(/view === 'edit'[\s\S]*?closeToOverview[\s\S]*?modalActions/)?.[0] || '';
  assert.match(editSlice, /avatarGenBtn/);
  assert.match(editSlice, /avatarUploadBtn/);
  assert.match(editSlice, /avatarZoomCue/);
  assert.doesNotMatch(
    editSlice,
    /fieldAiBtnSecondary/,
    '编辑头像区不得再用挤成一行的次级小按钮',
  );
});

test('player-avatar_手动生图不再AB_DISABLED', () => {
  const fnStart = beHandler.indexOf('export async function postSessionPlayerAvatarHandler');
  assert.ok(fnStart >= 0);
  const slice = beHandler.slice(fnStart, fnStart + 1200);
  assert.doesNotMatch(slice, /AB_DISABLED/);
  assert.match(slice, /手动生图始终开放/);
});
