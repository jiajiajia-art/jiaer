/**
 * 游玩中新人物套用平台头像库：按性别 / 年龄段猜分类；本剧池抽不到时落到平台头像库。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('guessAvatarCategory_按性别年龄分类', async () => {
  const mod = await import(join(root, 'Romance/src/game/avatarCategory.ts'));
  assert.equal(mod.guessAvatarCategory({ identity: '旅馆老板娘', age: '45' }), '青年女性');
  assert.equal(mod.guessAvatarCategory({ identity: '退休的老爷子', age: '70' }), '成熟男性');
  assert.equal(mod.guessAvatarCategory({ identity: '邻居家的小孩', bio: '他总是跑来跑去', age: '8' }), '幼年男性');
  assert.equal(mod.guessAvatarCategory({ identity: '镇上的大姐' }), '青年女性');
});

test('drawProfileAvatar_接入新人物与开局补头像', async () => {
  const { readFileSync } = await import('node:fs');
  const ai = readFileSync(join(root, 'Romance/src/lib/ai.ts'), 'utf8');
  const ctx = readFileSync(join(root, 'Romance/src/store/GameContext.tsx'), 'utf8');
  assert.match(ai, /drawProfileAvatar\(npc\.id/);
  assert.match(ctx, /preloadPlatformAvatarPools\(\)/);
});
