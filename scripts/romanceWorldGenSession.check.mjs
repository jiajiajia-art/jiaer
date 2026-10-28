/**
 * 生成世界向导会话：刷新须留在向导/编辑器，恢复步骤与滚动，禁止掉进游戏。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenSession_parse与过期丢弃_以及App刷新续开', async () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      mem.set(k, String(v));
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const sess = await import(pathToFileURL(join(romance, 'lib/worldGenSession.ts')).href);
  assert.equal(sess.parseWorldGenSession(null), null);
  assert.equal(sess.parseWorldGenSession({ step: 2 }), null);

  const ok = {
    step: 2,
    s1: {
      title: '雾港来信',
      setting: '海边旅店',
      aiPolish: true,
      engineId: 'balanced',
      contentIds: ['world'],
      editorStepIds: ['prompt'],
    },
    draft: null,
    mod: { id: 'w1', name: '雾港来信', version: '0.1.0', author: '', description: '', kind: 'world', dependencies: [], content: {} },
    scrollY: 420,
    editorGroup: 'story',
    updatedAt: Date.now(),
  };
  assert.equal(sess.parseWorldGenSession(ok)?.scrollY, 420);
  assert.equal(sess.parseWorldGenSession(ok)?.editorGroup, 'story');

  assert.ok(sess.saveWorldGenSession(ok));
  assert.equal(sess.shouldResumeWorldGenSession(), true);
  assert.equal(sess.loadWorldGenSession()?.s1.title, '雾港来信');
  assert.match(sess.WORLD_GEN_SESSION_KEY, /\.v2$/);
  assert.match(sess.WORLD_GEN_SESSION_KEY_LEGACY, /\.v1$/);
  // 旧 v1 会话不得续开成 59 项全选
  mem.set(
    sess.WORLD_GEN_SESSION_KEY_LEGACY,
    JSON.stringify({ ...ok, s1: { ...ok.s1, editorStepIds: Array.from({ length: 59 }, (_, i) => `x${i}`) } }),
  );
  assert.equal(sess.loadWorldGenSession()?.s1.title, '雾港来信'); // 仍读 v2
  sess.clearWorldGenSession();
  assert.equal(sess.shouldResumeWorldGenSession(), false);
  // clear 后 load 会顺带清 v1
  assert.equal(mem.has(sess.WORLD_GEN_SESSION_KEY_LEGACY), false);

  // 过期会话不得挡游戏（直接写存储，避免 save 刷新 updatedAt）
  mem.set(
    sess.WORLD_GEN_SESSION_KEY,
    JSON.stringify({
      ...ok,
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
    }),
  );
  assert.equal(sess.shouldResumeWorldGenSession(), false);
});

test('App与Wizard_刷新续开会话契约', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');

  assert.match(app, /shouldResumeWorldGenSession/);
  assert.match(app, /ensureWorldGenQuery/);
  assert.match(app, /clearWorldGenSession/);
  // 禁止打开向导时立刻清掉 createWorld（旧行为会导致刷新进游戏）
  assert.doesNotMatch(app, /if \(!worldGenOpen\) return;\s*clearWorldGenQuery\(\)/);

  assert.match(wiz, /loadWorldGenSession|bootFromSession/);
  assert.match(wiz, /saveWorldGenSession/);
  assert.match(wiz, /onLiveChange|onChromeChange|initialGroup/);
  assert.match(panel, /initialGroup/);
  assert.match(panel, /onLiveChange/);
  assert.match(panel, /onChromeChange/);
});
