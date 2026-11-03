/**
 * 地点场景图：编辑器只收 9:16 / 1080×1920；局内 9:16 框 object-cover 铺满；
 * 正文在场景图下累积留屏，底部只留输入与行动。
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
  assert.doesNotMatch(rooms, /方向出口/);
  const map = read('components/MapSpotExtras.tsx');
  assert.match(map, /scenePortrait:\s*true/);
  assert.match(map, /SCENE_PORTRAIT_HINT/);
});

test('LocationHero_固定9比16铺满_不用横条contain', () => {
  const home = read('components/HomeTab.tsx');
  const m = home.match(/function LocationHero\([\s\S]*?\n\}\n\n\/\* 人物档案卡/);
  assert.ok(m, '找不到 LocationHero');
  const hero = m[0];
  assert.match(hero, /aspect-\[9\/16\]/);
  assert.match(hero, /object-cover/);
  assert.doesNotMatch(hero, /object-contain/);
  assert.match(hero, /外出/);
  assert.match(hero, /data-tour="spots"/);
});

test('HomeTab_正文在图下累积_底部只留输入_无逐句对话框', () => {
  const home = read('components/HomeTab.tsx');
  assert.match(home, /data-tour="scene-prose"/);
  assert.match(home, /game\.story\.map/);
  assert.doesNotMatch(home, /function GalPlayer/);
  assert.doesNotMatch(home, /paceActive/);
  assert.doesNotMatch(home, /novelProse/);
  assert.match(home, /写下你的行动，或说一句台词/);
  assert.match(home, /底部：只留输入框与行动选项/);
});
