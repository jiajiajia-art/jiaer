/**
 * 书架：封面字段、去掉草稿箱 Tab、管理常驻、草稿角标右上。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('CreatorWorksPanel_无草稿箱Tab且各视图有管理', () => {
  const panel = read('src/components/Create/CreatorWorksPanel.tsx');
  assert.doesNotMatch(panel, /create\.draftBox/);
  assert.doesNotMatch(panel, /worksTab === 'drafts'/);
  assert.match(panel, /normalizeWorksTabKey/);
  assert.match(panel, /canShowManage/);
  assert.match(panel, /create\.manage/);
  assert.match(panel, /showWorkStatus/);
});

test('GameGrid_草稿角标在右上题材下方', () => {
  const css = read('src/components/GameGrid.module.css');
  const block = css.match(/\.workStatusTag\s*\{[\s\S]*?\n\}/);
  assert.ok(block, 'workStatusTag missing');
  assert.match(block[0], /right:\s*10px/);
  assert.match(block[0], /top:\s*42px/);
  assert.doesNotMatch(block[0], /left:\s*10px/);
});

test('getImageUrl_透传data与blob封面', () => {
  const src = read('src/utils/constants.ts');
  assert.match(src, /startsWith\("data:"\)/);
  assert.match(src, /startsWith\("blob:"\)/);
});

test('platformRomanceDraft_抽出封面并随PATCH同步', async () => {
  const mod = await import(
    pathToFileURL(join(root, 'Romance/src/lib/platformRomanceDraft.ts')).href + `?t=${Date.now()}`
  );
  assert.equal(
    mod.resolveRomanceDraftCoverUrl({
      cover: 'https://a/cover.webp',
      content: {},
    }),
    'https://a/cover.webp',
  );
  assert.equal(
    mod.resolveRomanceDraftCoverUrl({
      content: { cover: { cgs: ['https://b/1.jpg'] } },
    }),
    'https://b/1.jpg',
  );
  const panel = read('Romance/src/components/WorldGenWizard.tsx');
  assert.match(panel, /resolveRomanceDraftCoverUrl/);
  assert.match(panel, /coverUrl:\s*resolveRomanceDraftCoverUrl/);
});

test('worldGenSession_带draftId不回落全局键且本机草稿按作品隔离', async () => {
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
  mem.set(
    'auth-storage',
    JSON.stringify({ state: { user: { token: 't', user: { userId: 'u1' } } } }),
  );
  const sess = await import(
    pathToFileURL(join(root, 'Romance/src/lib/worldGenSession.ts')).href + `?t=${Date.now()}`
  );
  const cands = sess.worldGenSessionKeyCandidates('?draftId=workA');
  assert.ok(cands.every((k) => String(k).includes('workA')));
  assert.equal(sess.worldGenLocalDraftStorageId('?draftId=workA'), 'platform.workA');
  assert.equal(sess.worldGenLocalDraftStorageId('?createWorld=1'), 'new');
});

test('WorldGenWizard_resume按updatedAt取较新且localDraftKey隔离', () => {
  const wiz = read('Romance/src/components/WorldGenWizard.tsx');
  assert.match(wiz, /remoteAt >= localAt/);
  assert.match(wiz, /worldGenLocalDraftStorageId/);
  assert.match(wiz, /localDraftKey=\{worldGenDraftId\}/);
  assert.doesNotMatch(wiz, /WORLD_GEN_DRAFT_ID = "mod\.new"/);
});
