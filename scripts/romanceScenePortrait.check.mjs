/**
 * 地点场景图：编辑器仍收 9:16 / 1080×1920；局内矮横幅 object-cover，正文叠图上；
 * 底部只留输入与行动。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('scenePortrait_规格与拦截文案', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/scenePortrait.ts')).href);
  assert.equal(mod.SCENE_PORTRAIT_WIDTH, 1080);
  assert.equal(mod.SCENE_PORTRAIT_HEIGHT, 1920);
  assert.equal(mod.SCENE_PORTRAIT_HINT, '场景图会裁成 9:16 竖图（1080×1920）');
  assert.equal(mod.SCENE_PORTRAIT_GEN_SIZE, '1080x1920');
  assert.equal(mod.isScenePortraitSize(1080, 1920), true);
  assert.equal(mod.isScenePortraitSize(1920, 1080), false);
  assert.equal(mod.isScenePortraitSize(1080, 1919), false);
  assert.equal(mod.scenePortraitSizeError(800, 600), '场景图会裁成 9:16 竖图（1080×1920）');
  assert.equal(mod.scenePortraitSizeError(1080, 1920), null);
});

test('ImagePicker与地点编辑器启用scenePortrait裁切与生图', () => {
  const picker = read('components/ImagePicker.tsx');
  assert.match(picker, /scenePortrait/);
  assert.match(picker, /fileToScenePortraitDataUrl/);
  assert.match(picker, /SCENE_PORTRAIT_HINT/);
  assert.match(picker, /生图/);
  const rooms = read('components/ModRoomTreeEditor.tsx');
  assert.match(rooms, /scenePortrait/);
  assert.match(rooms, /1080×1920/);
  assert.match(rooms, /9:16/);
  assert.match(rooms, /aiGen/);
  assert.match(rooms, /buildLocationScenePrompt/);
  assert.doesNotMatch(rooms, /方向出口/);
  const map = read('components/MapSpotExtras.tsx');
  assert.match(map, /scenePortrait:\s*true/);
  assert.match(map, /SCENE_PORTRAIT_HINT/);
});

test('LocationHero_矮横幅铺满_不用contain', () => {
  const home = read('components/HomeTab.tsx');
  const m = home.match(/function LocationHero\([\s\S]*?\n\}\n\n\/\* 人物档案卡/);
  assert.ok(m, '找不到 LocationHero');
  const hero = m[0];
  assert.match(hero, /aspect-\[16\/10\]/);
  assert.doesNotMatch(hero, /aspect-\[9\/16\]/);
  assert.match(hero, /object-cover/);
  assert.doesNotMatch(hero, /object-contain/);
  assert.match(hero, /外出/);
  assert.match(hero, /data-tour="spots"/);
  assert.match(hero, /data-tour="scene-prose"/);
  assert.match(hero, /data-scene-layout="fill"/);
  assert.match(hero, /data-scene-layout="banner"/);
});

test('HomeTab_正文在场景区_输入可进内容卡_无逐句对话框', () => {
  const home = read('components/HomeTab.tsx');
  assert.match(home, /data-tour="scene-prose"/);
  assert.match(home, /game\.story\.map/);
  assert.doesNotMatch(home, /function GalPlayer/);
  assert.doesNotMatch(home, /paceActive/);
  assert.doesNotMatch(home, /novelProse/);
  assert.match(home, /写下你的行动，或说一句台词/);
  assert.match(home, /底部：游戏模式放输入|底部：只留输入框与行动选项/);
  assert.match(home, /正文已叠在场景图上|正文叠在图上|场景铺满 \+ 内容卡/);
  assert.match(home, /playPrefs\.mode === "novel"/);
  assert.match(home, /isAuthorPreview\(\)/);
  assert.match(home, /fill=\{novelFill\}/);
  assert.match(home, /novelCard=\{isNovel\}/);
});
