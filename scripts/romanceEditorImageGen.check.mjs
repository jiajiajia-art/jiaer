/**
 * 编辑器四处生图：人物头像 / 大地图 / 地点场景 / 作品封面
 * 一律复用 ImagePicker → AiImageGen → platformImageGen，不另起网关。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('editorImagePrompts_四处拼装含关键字段', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  const npc = mod.buildNpcAvatarPrompt({
    name: '沈姨',
    gender: '女',
    age: 52,
    summary: '旅馆厨娘',
    bio: '后厨掌勺十几年',
  });
  assert.match(npc, /沈姨/);
  assert.match(npc, /女/);
  assert.match(npc, /52/);
  assert.match(npc, /旅馆厨娘/);
  assert.match(npc, /后厨掌勺/);
  assert.equal(mod.buildNpcAvatarPrompt({}), '');

  const map = mod.buildWorldMapPrompt({ name: '主地图', desc: '雾色旅馆' });
  assert.match(map, /主地图/);
  assert.match(map, /雾色旅馆/);
  assert.equal(mod.buildWorldMapPrompt({}), '');

  const scene = mod.buildLocationScenePrompt({ name: '旅馆前院', desc: '石板路湿漉漉' });
  assert.match(scene, /旅馆前院/);
  assert.match(scene, /石板路/);
  assert.match(scene, /9:16/);
  assert.equal(mod.buildLocationScenePrompt({}), '');

  const cover = mod.buildWorkCoverPrompt({ title: '雾色旅馆', summary: '继承故事' });
  assert.match(cover, /雾色旅馆/);
  assert.match(cover, /继承故事/);
  assert.match(cover, /9:16/);
  assert.equal(mod.buildWorkCoverPrompt({}), '');
});

test('AiImageGen_支持autoRun与autoApply且仍走platformImageGen', () => {
  const gen = read('components/AiImageGen.tsx');
  assert.match(gen, /generatePlatformImage/);
  assert.match(gen, /autoRun/);
  assert.match(gen, /autoApply/);
  assert.match(gen, /if \(autoApply\) onPickRef\.current\(url\)/);
  assert.doesNotMatch(gen, /from ["']\.\.\/lib\/ai["']/);
});

test('ImagePicker_有预填词时默认自动生成并立刻写回', () => {
  const picker = read('components/ImagePicker.tsx');
  assert.match(picker, /autoRun/);
  assert.match(picker, /autoApply/);
  assert.match(picker, /initialPrompt/);
  assert.match(picker, /autoRun=\{genOpts\.autoRun !== false/);
  assert.match(picker, /autoApply=\{genOpts\.autoApply !== false/);
});

test('人物卡_ImagePicker生图接入姓名性别年龄简介小传', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /buildNpcAvatarPrompt/);
  assert.match(panel, /from ["']\.\.\/lib\/editorImagePrompts["']/);
  assert.match(panel, /n\.summary/);
  assert.match(panel, /aria-label="人物简介"/);
  assert.match(panel, /n\.avatar/);
  assert.match(panel, /aiGen=\{\{[\s\S]*buildNpcAvatarPrompt/);
  const content = read('worlds/star2005/content.ts');
  assert.match(content, /avatar\?: string/);
  assert.match(content, /summary\?: string/);
  const store = read('lib/store.ts');
  assert.match(store, /p\.avatar/);
  assert.match(store, /drawAvatar/);
});

test('大地图与地点_接同一套生图', () => {
  const rooms = read('components/ModRoomTreeEditor.tsx');
  assert.match(rooms, /buildWorldMapPrompt/);
  assert.match(rooms, /buildLocationScenePrompt/);
  assert.match(rooms, /大地图图/);
  assert.match(rooms, /patchMap\(curMap\.id, \{ bg:/);
  assert.match(rooms, /SCENE_PORTRAIT_GEN_SIZE/);
  assert.match(rooms, /scenePortrait/);
  assert.match(rooms, /initialPrompt: buildLocationScenePrompt/);
});

test('作品封面_生图用作品名与简介预填', () => {
  const cover = read('components/CoverDiyPanel.tsx');
  assert.match(cover, /buildWorkCoverPrompt/);
  assert.match(cover, /workTitle/);
  assert.match(cover, /workSummary/);
  assert.match(cover, /initialPrompt: buildWorkCoverPrompt/);
  const opening = read('components/ModOpeningEditor.tsx');
  assert.match(opening, /workTitle/);
  assert.match(opening, /workSummary/);
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /workTitle=\{m\.name\}/);
  assert.match(panel, /workSummary=\{m\.description\}/);
});

test('platformImageGen_仍委托generateImage不另起网关', () => {
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /return generateImage\(cfg, prompt, size\)/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
});
