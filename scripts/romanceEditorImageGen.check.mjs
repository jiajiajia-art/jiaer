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

test('AiImageGen_默认编辑页再开始生成_仍走platformImageGen', () => {
  const gen = read('components/AiImageGen.tsx');
  assert.match(gen, /generatePlatformImage/);
  assert.match(gen, /开始生成/);
  assert.match(gen, /重新生成/);
  assert.match(gen, /使用这张图/);
  assert.match(gen, /参考图/);
  assert.match(gen, /MAX_REFS = 2/);
  assert.match(gen, /取消生成/);
  assert.match(gen, /生成中不可修改/);
  assert.match(gen, /referenceImages: refs/);
  // 功能注释：兼容旧 props，但默认不得自动开跑
  assert.match(gen, /autoRun = false/);
  assert.match(gen, /autoApply = false/);
  assert.doesNotMatch(gen, /from ["']\.\.\/lib\/ai["']/);
});

test('ImagePicker_打开生图默认不自动跑不自动采用', () => {
  const picker = read('components/ImagePicker.tsx');
  assert.match(picker, /initialPrompt/);
  assert.match(picker, /autoRun=\{genOpts\.autoRun === true\}/);
  assert.match(picker, /autoApply=\{genOpts\.autoApply === true\}/);
  assert.match(picker, /title="生图"/);
  assert.match(picker, /onPhaseChange=\{setGenPhase\}/);
  assert.doesNotMatch(picker, /autoRun=\{genOpts\.autoRun !== false/);
  assert.doesNotMatch(picker, /autoApply=\{genOpts\.autoApply !== false/);
});

test('人物卡_ImagePicker生图接入姓名性别年龄小传', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /buildNpcAvatarPrompt/);
  assert.match(panel, /from ["']\.\.\/lib\/editorImagePrompts["']/);
  // 功能注释：短简介字段已并入小传；生图仍可读 summary/relation/role/bio
  assert.match(panel, /n\.summary|n\.bio|n\.relation/);
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

test('platformImageGen_登录优先平台API_未登录才个人Key', () => {
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /\/api\/romance\/images\/generate/);
  assert.match(src, /generateImageViaPlatform/);
  assert.match(src, /hasPlatformPlayAuth\(\)/);
  assert.match(src, /return generateImage\(cfg, prompt, size\)/);
  assert.match(src, /editorImageGenerateUrl/);
  // 功能注释：禁止再只认个人 AI 配置
  assert.match(src, /hasPlatformPlayAuth\(\) \|\| imageConfigured\(cfg\)/);
  assert.doesNotMatch(src, /还没配置生图模型：去「设置/);
});
