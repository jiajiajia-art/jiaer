/**
 * 出场立绘：局内重新生成须盖住创作台旧图（列表新、游戏旧 的回归锁）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPortraitSpeakerKey,
  pickSessionNpcAvatarUrl,
  resolveNpcPlayImagePath,
  resolveRawBridgeDialogueImagePath,
} from '../src/lib/galgame/npcPlayPortrait.ts';
import { stepToDisplayMessage } from '../src/lib/galgame/stepToDisplayMessage.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const oldDoc = '/api/visual/images/file1/npcs/npc_jin/base_1.png';
const newSession = '/public/visual/sessions/sid1/avatars/npc_jin_1710000000000.webp';

test('buildPortraitSpeakerKey_玩家与npc稳定键', () => {
  assert.equal(buildPortraitSpeakerKey({ isPlayer: true }), 'player');
  assert.equal(buildPortraitSpeakerKey({ speakerId: 'player' }), 'player');
  assert.equal(buildPortraitSpeakerKey({ speakerId: 'npc_a', speakerName: '甲' }), 'npc:npc_a');
  assert.equal(buildPortraitSpeakerKey({ speakerName: '甲' }), 'name:甲');
  assert.equal(buildPortraitSpeakerKey(null), '');
});

test('pickSessionNpcAvatarUrl_按id优先于同名', () => {
  const url = pickSessionNpcAvatarUrl(
    [
      { id: 'other', name: '金泰梨', avatarUrl: '/old.webp' },
      { id: 'npc_jin', name: '金泰梨', avatarUrl: newSession },
    ],
    { npcId: 'npc_jin', speakerName: '金泰梨' },
  );
  assert.equal(url, newSession);
});

test('pickSessionNpcAvatarUrl_问题10_id与姓名冲突时跟姓名立绘', () => {
  const url = pickSessionNpcAvatarUrl(
    [
      { id: 'shen_jiashu', name: '沈嘉树', avatarUrl: '/shen.webp' },
      { id: 'gu_wenjing', name: '顾闻璟', avatarUrl: '/gu.webp' },
    ],
    { npcId: 'shen_jiashu', speakerName: '顾闻璟' },
  );
  assert.equal(url, '/gu.webp');
});

test('pickSessionNpcAvatarUrl_无id时按现用名或曾用名', () => {
  assert.equal(
    pickSessionNpcAvatarUrl(
      [{ id: 'n1', name: '泰梨', originalName: '金泰梨', avatarUrl: newSession }],
      { speakerName: '金泰梨' },
    ),
    newSession,
  );
  assert.equal(
    pickSessionNpcAvatarUrl(
      [{ id: 'n1', name: '金泰梨', avatarUrl: newSession }],
      { speakerName: '金泰梨' },
    ),
    newSession,
  );
  assert.equal(
    pickSessionNpcAvatarUrl(
      [{ id: 'n1', name: '别人', avatarUrl: newSession }],
      { speakerName: '金泰梨' },
    ),
    '',
  );
});

test('resolveNpcPlayImagePath_局内新图盖住文档base与activeImage', () => {
  assert.equal(
    resolveNpcPlayImagePath({
      npcId: 'npc_jin',
      speakerName: '金泰梨',
      activeImage: 'base',
      documentImages: { base: oldDoc, happy: '/api/visual/images/file1/npcs/npc_jin/happy.png' },
      sessionAvatarUrl: newSession,
    }),
    newSession,
    '禁止仍走创作台旧全身图',
  );
  assert.equal(
    resolveNpcPlayImagePath({
      documentImages: { base: oldDoc },
      activeImage: 'happy',
      sessionAvatarUrl: '',
    }),
    oldDoc,
  );
  assert.equal(
    resolveNpcPlayImagePath({
      documentImages: { happy: '/doc-happy.png', base: oldDoc },
      activeImage: 'happy',
      sessionAvatarUrl: '',
    }),
    '/doc-happy.png',
  );
});

test('stepToDisplayMessage_对白须用局内avatarUrl而不是文档旧立绘', () => {
  const msg = stepToDisplayMessage(
    {
      type: 'dialogue',
      content: '再练一遍 Pick Me',
      speakerName: '金泰梨',
      npcId: 'npc_jin',
      activeImage: 'base',
    },
    {
      npcs: [{ id: 'npc_jin', images: { base: oldDoc }, portraitScale: 1.1 }],
    },
    {
      messageId: 9,
      resolveImageUrl: (p) => (p ? `url:${p}` : undefined),
      sessionNpcEdits: [{ id: 'npc_jin', name: '金泰梨', avatarUrl: newSession }],
    },
  );
  assert.equal(msg?.characterImage, `url:${newSession}`);
  assert.equal(msg?.portraitScale, 1, '局内重新生成立绘缩放须为 1');
});

test('stepToDisplayMessage_无局内头像仍回落文档', () => {
  const msg = stepToDisplayMessage(
    { type: 'dialogue', content: '你好', speakerName: '赵墨', npcId: 'n1' },
    { npcs: [{ id: 'n1', images: { base: 'npc.png' }, portraitScale: 1.1 }] },
    { messageId: 2, resolveImageUrl: (p) => (p ? `url:${p}` : undefined) },
  );
  assert.equal(msg?.characterImage, 'url:npc.png');
  assert.equal(msg?.portraitScale, 1.1);
});

test('Galgame与消息层须接入局内NPC立绘', () => {
  const galgame = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(galgame, /sessionNpcEdits,/);
  assert.match(galgame, /pickSessionNpcAvatarUrl/);
  assert.match(galgame, /sessionNpcPortraitUrl \|\| msg\.characterImage/);
  assert.doesNotMatch(
    galgame,
    /characterImage: isPlayerBubble\s*\?[\s\S]*sessionPortraitUrl \|\| msg\.characterImage[\s\S]*: msg\.characterImage/,
    '禁止 NPC 对白仍直接用文档 msg.characterImage',
  );

  const messageHook = readFileSync(join(root, 'src/hooks/galgame/useGalgameMessage.ts'), 'utf8');
  assert.match(messageHook, /pickSessionNpcAvatarUrl/);
  assert.match(messageHook, /resolveNpcPlayImagePath/);
  assert.match(messageHook, /sessionNpcEdits/);

  const controller = readFileSync(join(root, 'src/hooks/galgame/useGalgameController.ts'), 'utf8');
  assert.match(controller, /sessionNpcEdits,/);
  assert.match(controller, /resolveNpcPlayImagePath/);
  assert.match(controller, /resolveRawBridgeDialogueImagePath/);
});

test('resolveRawBridgeDialogueImagePath_主角须吃activeImage兜底', () => {
  assert.equal(
    resolveRawBridgeDialogueImagePath({
      isPlayer: true,
      sessionPlayerAvatarUrl: '',
      playerDocumentImagePath: '',
      activeImage: '/public/players/base.png',
    }),
    '/public/players/base.png',
  );
  assert.equal(
    resolveRawBridgeDialogueImagePath({
      isPlayer: true,
      sessionPlayerAvatarUrl: '/session-player.webp',
      playerDocumentImagePath: '/doc-player.png',
      activeImage: '/public/players/base.png',
    }),
    '/session-player.webp',
  );
  assert.equal(
    resolveRawBridgeDialogueImagePath({
      isPlayer: false,
      activeImage: 'base',
      documentImages: { base: oldDoc },
      sessionNpcAvatarUrl: '',
    }),
    oldDoc,
  );
});
