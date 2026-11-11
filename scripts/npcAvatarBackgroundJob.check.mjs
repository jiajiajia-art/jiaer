/**
 * 局内 NPC 头像后台生成：可保存离开，完成后只合并头像字段
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeNpcAvatarIntoProfiles } from '../src/lib/galgame/npcAvatarMerge.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobSrc = readFileSync(join(root, 'src/lib/galgame/npcAvatarBackgroundJob.ts'), 'utf8');
const formSrc = readFileSync(join(root, 'src/components/Galgame/panels/CharacterProfileForm.tsx'), 'utf8');
const galgameSrc = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
const handlerSrc = readFileSync(
  join(root, '../Interactive-fiction-backend/interface/handlers/visual/sessionPlayerProfiles.js'),
  'utf8',
);
const apiSrc = readFileSync(join(root, 'src/api/galgame/playerCharacterCards.ts'), 'utf8');

test('mergeNpcAvatarIntoProfiles_只改头像保留姓名人设', () => {
  const next = mergeNpcAvatarIntoProfiles(
    [{
      id: 'n1',
      name: '沈曼',
      gender: 'female',
      relationship: '时尚买手',
      summary: '已保存简介',
      attitudeToPlayer: '自信',
      avatarUrl: '/old.webp',
    }],
    {
      npcId: 'n1',
      avatarUrl: '/new.webp',
      avatarThumbUrl: '/new_150.webp',
    },
  );
  assert.equal(next[0].name, '沈曼');
  assert.equal(next[0].summary, '已保存简介');
  assert.equal(next[0].avatarUrl, '/new.webp');
  assert.equal(next[0].avatarThumbUrl, '/new_150.webp');
});

test('mergeNpcAvatarIntoProfiles_未知id也写入头像条目', () => {
  const prev = [{
    id: 'n1',
    name: '沈曼',
    gender: 'female',
    relationship: '同学',
    summary: '简介',
    attitudeToPlayer: '友善',
  }];
  const next = mergeNpcAvatarIntoProfiles(prev, {
    npcId: 'n2',
    avatarUrl: '/public/visual/sessions/s1/avatars/n2.webp',
  });
  assert.equal(next.length, 2);
  assert.equal(next[1].id, 'n2');
  assert.equal(next[1].avatarUrl, '/public/visual/sessions/s1/avatars/n2.webp');
});

test('mergeIncomingNpcProfiles_局内新图不被文档旧图盖掉', async () => {
  const { mergeIncomingNpcProfiles } = await import('../src/lib/galgame/npcAvatarMerge.ts');
  const next = mergeIncomingNpcProfiles(
    [{
      id: 'n1',
      name: '沈曼',
      gender: 'female',
      relationship: '时尚买手',
      summary: '简介',
      attitudeToPlayer: '自信',
      avatarUrl: '/api/visual/images/x/npcs/n1/base.png',
    }],
    [{
      id: 'n1',
      name: '沈曼',
      gender: 'female',
      relationship: '时尚买手',
      summary: '简介',
      attitudeToPlayer: '自信',
      avatarUrl: '/public/visual/sessions/s1/avatars/n1_new.webp',
      avatarThumbUrl: '/public/visual/sessions/s1/avatars/n1_new_150.webp',
    }],
  );
  assert.equal(next[0].avatarUrl, '/public/visual/sessions/s1/avatars/n1_new.webp');
});

test('mergeIncomingNpcProfiles_重新生成后旧局内图不能盖新图', async () => {
  const { mergeIncomingNpcProfiles, sessionPortraitTimestamp } = await import(
    '../src/lib/galgame/npcAvatarMerge.ts'
  );
  assert.equal(
    sessionPortraitTimestamp('/public/visual/sessions/s1/avatars/n1_1700000000001.webp'),
    1700000000001,
  );
  const next = mergeIncomingNpcProfiles(
    [{
      id: 'n1',
      name: '沈曼',
      gender: 'female',
      relationship: '时尚买手',
      summary: '简介',
      attitudeToPlayer: '自信',
      avatarUrl: '/public/visual/sessions/s1/avatars/n1_1700000000001.webp',
      avatarThumbUrl: '/public/visual/sessions/s1/avatars/n1_1700000000001_150.webp',
    }],
    [{
      id: 'n1',
      name: '沈曼',
      gender: 'female',
      relationship: '时尚买手',
      summary: '简介',
      attitudeToPlayer: '自信',
      avatarUrl: '/public/visual/sessions/s1/avatars/n1_1700000009999.webp',
      avatarThumbUrl: '/public/visual/sessions/s1/avatars/n1_1700000009999_150.webp',
    }],
  );
  assert.equal(next[0].avatarUrl, '/public/visual/sessions/s1/avatars/n1_1700000009999.webp');
  assert.equal(next[0].avatarThumbUrl, '/public/visual/sessions/s1/avatars/n1_1700000009999_150.webp');
});

test('CharacterProfileForm_生成中可保存离开', () => {
  assert.match(formSrc, /startNpcAvatarBackgroundGen/);
  assert.match(formSrc, /subscribeNpcAvatarGenBusy/);
  assert.match(formSrc, /可先保存或离开/);
  assert.match(formSrc, /omitAvatarWhileGenerating/);
  assert.match(formSrc, /disabled=\{formLocked \|\| fieldAiBusy \|\| avatarUploading\}/);
  assert.doesNotMatch(
    formSrc,
    /primary[\s\S]{0,80}anyAiBusy/,
    '保存不得被头像生成卡住',
  );
  assert.doesNotMatch(
    formSrc,
    /primary[\s\S]{0,80}avatarAiBusy/,
    '保存不得被头像生成卡住',
  );
});

test('Galgame_订阅角色头像生成完成写回列表', () => {
  assert.match(galgameSrc, /subscribeNpcAvatarGenComplete/);
  assert.match(galgameSrc, /mergeIncomingNpcProfiles/);
  assert.match(galgameSrc, /角色头像已生成/);
  assert.match(galgameSrc, /pendingNpcAvatarsRef/);
});

test('backend_npc-avatar落盘重读session只补丁头像', () => {
  assert.match(handlerSrc, /落盘前重读 session，只补丁头像字段/);
  assert.match(handlerSrc, /patchSessionNpcAvatar/);
  assert.match(handlerSrc, /withSessionLockRetry/);
});

test('CharacterProfileForm_生成中点取消须终止生图', () => {
  assert.match(formSrc, /handleCancel/);
  assert.match(formSrc, /cancelNpcAvatarBackgroundGen/);
  assert.match(formSrc, /NPC_AVATAR_GEN_CANCELLED_MESSAGE/);
  assert.match(formSrc, /secondary[\s\S]{0,80}onClick=\{handleCancel\}/);
  assert.match(formSrc, /formClose[\s\S]{0,80}onClick=\{handleCancel\}/);
  assert.doesNotMatch(
    formSrc,
    /secondary[\s\S]{0,80}onClick=\{onCancel\}/,
    '取消须先终止生图，不能直接 onCancel',
  );
});

test('npcAvatarBackgroundJob_须有客户端超时与cancel清busy', () => {
  assert.match(jobSrc, /NPC_AVATAR_GEN_CLIENT_TIMEOUT_MS = 120_000/);
  assert.match(jobSrc, /NPC_AVATAR_GEN_CANCELLED_MESSAGE/);
  assert.match(jobSrc, /cancelNpcAvatarBackgroundGen/);
  assert.match(jobSrc, /jobsBySessionNpc\.delete\(key\)/);
  assert.match(jobSrc, /jobsBySessionNpc\.set\(key, job\)/);
  assert.match(apiSrc, /opts\?: \{ signal\?: AbortSignal \}/);
  assert.match(apiSrc, /signal: opts\?\.signal/);
});

test('backend_npc-avatar取消不扣积分不落盘', () => {
  assert.match(handlerSrc, /signal:\s*c\.req\.raw\?\.signal/);
  assert.match(handlerSrc, /IMAGE_GEN_ABORTED/);
  assert.match(handlerSrc, /已取消头像生成/);
});
