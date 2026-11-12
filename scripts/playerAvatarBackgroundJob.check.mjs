/**
 * 主角头像后台生成：可离开页面，完成后只合并头像字段；客户端超时必清 busy
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBackend, skipNoBackend } from './_backendRepo.mjs';
import {
  mergeIncomingSessionPlayerProfile,
  mergePlayerAvatarIntoProfile,
} from '../src/lib/galgame/playerAvatarMerge.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobSrc = readFileSync(join(root, 'src/lib/galgame/playerAvatarBackgroundJob.ts'), 'utf8');
const apiSrc = readFileSync(join(root, 'src/api/galgame/playerCharacterCards.ts'), 'utf8');

test('mergePlayerAvatarIntoProfile_只改头像保留姓名人设', () => {
  const next = mergePlayerAvatarIntoProfile(
    {
      name: '顾明远',
      gender: 'male',
      persona: '已保存人设',
      customAttributes: { a: '1' },
    },
    {
      avatarUrl: '/new.webp',
      avatarThumbUrl: '/new_150.webp',
    },
  );
  assert.equal(next.name, '顾明远');
  assert.equal(next.persona, '已保存人设');
  assert.equal(next.avatarUrl, '/new.webp');
  assert.equal(next.avatarThumbUrl, '/new_150.webp');
  assert.equal(next.avatarNeedsRegen, false);
  assert.deepEqual(next.customAttributes, { a: '1' });
});

test('mergeIncomingSessionPlayerProfile_playUi旧快照不得冲掉本局新立绘', () => {
  const oldUrl = '/public/visual/sessions/s1/avatars/player_1700000001000.webp';
  const newUrl = '/public/visual/sessions/s1/avatars/player_1700000009000.webp';
  const local = {
    name: '林知夏',
    gender: 'female',
    persona: '理性, 冷静',
    customAttributes: {},
    avatarUrl: newUrl,
    avatarThumbUrl: '/public/visual/sessions/s1/avatars/player_1700000009000_150.webp',
  };
  const incoming = {
    name: '林知夏',
    gender: 'female',
    persona: '理性, 冷静',
    customAttributes: {},
    avatarUrl: oldUrl,
    avatarThumbUrl: '/public/visual/sessions/s1/avatars/player_1700000001000_150.webp',
  };
  const merged = mergeIncomingSessionPlayerProfile(incoming, local);
  assert.equal(merged?.avatarUrl, newUrl);
  assert.equal(
    merged?.avatarThumbUrl,
    '/public/visual/sessions/s1/avatars/player_1700000009000_150.webp',
  );
});

test('AttributesPanel_playUi回写须择优合并主角立绘', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/panels/AttributesPanel.tsx'), 'utf8');
  assert.match(src, /mergeIncomingSessionPlayerProfile/);
  assert.doesNotMatch(
    src,
    /setPlayerProfile\(data\.sessionPlayerProfile\)/,
    '禁止把 play-ui 档案整表直接 set 冲掉本局新头像',
  );
});

test('Galgame_档案变更须按时间戳合并立绘', () => {
  const src = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /mergeIncomingSessionPlayerProfile/);
  assert.match(src, /handleSessionPlayerProfileChange/);
});

test('mergePlayerAvatarIntoProfile_重生成后缩放路径须识别为sessions', async () => {
  const { resolvePlayPortraitScale } = await import('../src/lib/galgame/playerCharacterCard.ts');
  const next = mergePlayerAvatarIntoProfile(
    {
      name: '黄黄',
      gender: 'female',
      persona: '人设',
      customAttributes: {},
      importedCardId: 'card1',
      avatarUrl: '/public/visual/player-cards/u1/avatars/card.webp',
    },
    {
      avatarUrl: '/public/visual/sessions/s1/avatars/player_regen.webp',
      avatarThumbUrl: '/public/visual/sessions/s1/avatars/player_regen_150.webp',
    },
  );
  assert.equal(next.avatarUrl, '/public/visual/sessions/s1/avatars/player_regen.webp');
  assert.equal(
    resolvePlayPortraitScale({
      sessionAvatarUrl: next.avatarUrl,
      documentPortraitScale: 0.8,
    }),
    1,
    '点击重新生成后立绘须 1（与文档同级）',
  );
});

test('PlayerArchiveSection_生成中可保存离开', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/panels/PlayerArchiveSection.tsx'), 'utf8');
  assert.match(src, /startPlayerAvatarBackgroundGen/);
  assert.match(src, /subscribePlayerAvatarGenBusy/);
  assert.match(src, /可先保存或离开/);
  assert.match(src, /primaryBtn[\s\S]{0,80}disabled=\{saving \|\| personaAiBusy\}/);
  assert.match(src, /secondaryBtn[\s\S]{0,80}disabled=\{saving \|\| personaAiBusy\}/);
  assert.doesNotMatch(
    src,
    /primaryBtn[\s\S]{0,80}avatarAiBusy/,
    '保存不得被头像生成卡住',
  );
  assert.doesNotMatch(
    src,
    /modalClose[\s\S]{0,120}avatarAiBusy/,
    '关闭编辑也不得被头像生成卡住',
  );
});

test('Galgame_订阅头像生成完成写回档案', () => {
  const src = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /subscribePlayerAvatarGenComplete/);
  assert.match(src, /mergePlayerAvatarIntoProfile/);
  assert.match(src, /头像已生成并保存/);
});

test('backend_player-avatar落盘重读session只补丁头像', { skip: skipNoBackend }, () => {
  const src = readBackend('interface/handlers/visual/sessionPlayerProfiles.js');
  assert.match(src, /落盘前重读 session，只补丁头像字段/);
  assert.match(src, /avatarNeedsRegen:\s*false/);
  assert.doesNotMatch(
    src,
    /applySessionPlayerProfile\(withAb,\s*\{\s*\.\.\.profile,\s*name,/,
    '禁止用生成开始时的姓名人设整表覆盖',
  );
});

test('playerAvatarBackgroundJob_须有客户端超时与cancel清busy', () => {
  assert.match(jobSrc, /PLAYER_AVATAR_GEN_CLIENT_TIMEOUT_MS = 120_000/);
  assert.match(jobSrc, /cancelPlayerAvatarBackgroundGen/);
  assert.match(jobSrc, /jobsBySession\.delete\(sid\)/);
  assert.match(jobSrc, /signal: abort\.signal/);
  assert.match(jobSrc, /头像生成超时/);
  assert.match(apiSrc, /opts\?: \{ signal\?: AbortSignal \}/);
  assert.match(apiSrc, /signal: opts\?\.signal/);
});
