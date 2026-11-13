/**
 * C0.1 创作者身份门禁：未激活锁定玩法 Mod / 手机应用；提示原文；直链拦截。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('creatorIdentity_已公开发布才算激活', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/lib/creatorIdentity.ts')).href);
  assert.equal(mod.isCreatorIdentityActivated([]), false);
  assert.equal(mod.isCreatorIdentityActivated([{ is_public: 0 }]), false);
  assert.equal(mod.isCreatorIdentityActivated([{ is_public: 1, moderation_status: 'pending_review' }]), false);
  assert.equal(mod.isCreatorIdentityActivated([{ is_public: 1 }]), true);
  assert.match(mod.CREATOR_IDENTITY_LOCKED_HINT, /需要过审作品解锁创作者身份即可使用/);
});

test('CreateType_玩法与应用入口有门禁锁定与提示', () => {
  const tsx = read('src/page/CreateType.tsx');
  assert.match(tsx, /isCreatorIdentityActivated/);
  assert.match(tsx, /CREATOR_IDENTITY_LOCKED_HINT/);
  assert.match(tsx, /需要创作者身份|去创作游戏世界/);
  assert.match(tsx, /badge=\{creatorActivated === false \? 'locked'/);
});

test('CreatePlatformApp与PlayModCreateShell_直链门禁', () => {
  const app = read('src/page/CreatePlatformApp.tsx');
  const shell = read('Romance/src/components/PlayModCreateShell.tsx');
  assert.match(app, /isCreatorIdentityActivated/);
  assert.match(app, /navigate\('\/create'/);
  assert.match(app, /hideBottomNav/);
  // 运营「已上架应用」区块只对运营角色显示与拉取（后端仍需自行鉴权）
  assert.match(app, /const isStaff = isOperatorRole\(role\)/);
  assert.match(app, /if \(isStaff\) \{\s*const pub = await platformAppsApi\.listPublished/);
  assert.match(app, /\{isStaff \? \(\s*<section[^>]*>\s*<h2[^>]*>运营 · 已上架应用/);
  assert.match(shell, /需要过审作品解锁创作者身份即可使用/);
  assert.match(shell, /fetchCreatorActivated|校验创作者身份/);
  assert.match(shell, /← 返回/);
});
