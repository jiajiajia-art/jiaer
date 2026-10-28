/**
 * 会话脏 mod 进编辑器前必须可安全渲染（禁止 .trim is not a function）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('sanitizeModStrings_对象型label_terms_prompt_须收成字符串', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const dirty = {
    id: 'w1',
    name: { zh: '雾港' },
    version: '1.0.0',
    kind: 'world',
    content: {
      terms: { city: { n: '雾港' }, tabHome: ' 首页 ' },
      prompt: { gmIntro: { text: 'hi' }, worldIntro: ' 世界 ' },
      navTabs: [{ id: 'home', label: { t: '日程' }, on: true }],
      npcs: [{ id: 'a', name: 9, gender: { g: '女' } }],
      rooms: { inn: { name: { n: '客栈' }, desc: 12 } },
      bgm: [{ id: 'b1', name: { t: '雨声' }, src: 'https://x' }],
      startMet: { 0: 'a' },
      travel: { modes: [{ id: 'walk', label: { zh: '步行' }, cost: 0 }] },
      stats: { labels: { meili: { n: '魅力' }, caiyi: ' 才艺 ' } },
      opening: { paragraphs: ['a', { t: 'b' }, 3] },
    },
  };
  const clean = mod.sanitizeModStrings(dirty);
  assert.equal(clean.name, '');
  assert.deepEqual(clean.content.terms, { tabHome: '首页' });
  assert.equal(clean.content.prompt.worldIntro, '世界');
  assert.equal(clean.content.prompt.gmIntro, undefined);
  assert.equal(clean.content.navTabs[0].label, 'home'); // 对象 label 回落为 id
  assert.equal(clean.content.npcs[0].name, '9');
  assert.equal(clean.content.rooms.inn.name, 'inn'); // 对象名回落为房间 id
  assert.equal(clean.content.rooms.inn.desc, '12');
  assert.equal(clean.content.bgm[0].name, '');
  assert.deepEqual(clean.content.startMet, ['a']);
  assert.equal(clean.content.travel.modes[0].label, '');
  assert.deepEqual(clean.content.stats.labels, { caiyi: '才艺' });
  assert.deepEqual(clean.content.opening.paragraphs, ['a', '3']);
});

test('worldGenSession_parse时须sanitize_mod', () => {
  const sessionSrc = readFileSync(join(romance, 'lib/worldGenSession.ts'), 'utf8');
  assert.match(sessionSrc, /sanitizeModStrings/);
  assert.match(sessionSrc, /parseWorldGenSession/);
  assert.match(sessionSrc, /demoteWorldGenSessionToStep1/);
  assert.match(sessionSrc, /WORLD_GEN_PERSIST_BLOCK_KEY|isWorldGenPersistBlocked/);
  assert.match(sessionSrc, /isWorldGenTrimRecovering/);
});

test('WorldGenWizard与ModEditorPanel_须在加载会话时sanitize', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(wiz, /sanitizeModStrings/);
  assert.match(panel, /sanitizeModStrings\(structuredClone\(initial\)\)|sanitizeModStrings\(initial\)/);
  assert.doesNotMatch(readFileSync(join(romance, 'components/NavTabsModEditor.tsx'), 'utf8'), /row\.label\.trim\(\)/);
});
