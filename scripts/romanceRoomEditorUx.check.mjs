/**
 * 地点编辑：不展示房间 id / 方向出口；AI·地点库·清洗须带场景描述；上传可用；链接改生图。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('ModRoomTreeEditor_不展示房间id且无方向出口表', () => {
  const src = read('components/ModRoomTreeEditor.tsx');
  assert.doesNotMatch(src, /方向出口/);
  assert.doesNotMatch(src, /DIRS\s*=/);
  assert.doesNotMatch(src, /地点 id（失焦后生效）/);
  assert.doesNotMatch(src, /font-mono.*defaultValue=\{cur\}|defaultValue=\{cur\}.*font-mono/);
  assert.doesNotMatch(src, /onBlur=\{\(e\) => \{ onRename/);
  assert.match(src, /地点树自动连通/);
  assert.match(src, /scenePortrait/);
  assert.match(src, /aiGen=\{\{/);
  assert.match(src, /initialPrompt/);
  assert.match(src, /SCENE_PORTRAIT_GEN_SIZE/);
  assert.match(src, /sceneDescFallback|你来到了/);
  assert.match(src, /addFromLibrary/);
});

test('ensureRoomSceneDescs_空描述按地名补全', async () => {
  const { ensureRoomSceneDescs, sanitizeModStrings } = await import(
    pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href
  );
  const rooms = {
    a: { name: '禅房', desc: '' },
    b: { name: '厢房', desc: '已有描写' },
  };
  ensureRoomSceneDescs(rooms);
  assert.equal(rooms.a.desc, '你来到了「禅房」。');
  assert.equal(rooms.b.desc, '已有描写');

  const clean = sanitizeModStrings({
    id: 'w1',
    name: '雾',
    version: '1.0.0',
    kind: 'world',
    content: { rooms: { x: { name: '码头', desc: '' } } },
  });
  assert.equal(clean.content.rooms.x.desc, '你来到了「码头」。');
});

test('ImagePicker_场景图上传裁切且链接改生图', async () => {
  const picker = read('components/ImagePicker.tsx');
  assert.match(picker, /fileToScenePortraitDataUrl/);
  assert.match(picker, /rasterToScenePortraitDataUrl/);
  assert.match(picker, /showLink = !scenePortrait/);
  assert.match(picker, /initialPrompt/);
  const portrait = read('lib/scenePortrait.ts');
  assert.match(portrait, /drawScenePortraitDataUrl/);
  assert.match(portrait, /SCENE_PORTRAIT_GEN_SIZE/);
  const mod = await import(pathToFileURL(join(romance, 'lib/scenePortrait.ts')).href);
  assert.equal(mod.SCENE_PORTRAIT_GEN_SIZE, '1080x1920');
  assert.equal(mod.SCENE_PORTRAIT_HINT, '场景图会裁成 9:16 竖图（1080×1920）');
});

test('worldGen_地点字段要求desc必填且合并后ensure', () => {
  const gen = read('lib/worldGenGenerate.ts');
  assert.match(gen, /desc必填非空/);
  assert.match(gen, /ensureRoomSceneDescs\(merged\.rooms\)/);
});
