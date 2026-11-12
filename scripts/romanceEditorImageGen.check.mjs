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

test('editorImagePrompts_三层_画风可空禁止常驻二次元写实漫', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  // 功能注释：C1.1 不再常驻「二次元写实漫」；未填画风留空
  assert.equal(mod.resolveArtStyle(undefined), '');
  assert.equal(mod.resolveArtStyle('   '), '');
  assert.equal(mod.resolveArtStyle('水墨国风'), '水墨国风');
  assert.equal(mod.resolveArtStyle('', '宫斗写实'), '宫斗写实');

  const def = mod.buildNpcAvatarPromptParts({ gender: '女', age: 28, appearancePrompt: '黑色齐肩发，圆脸，米色针织衫' });
  assert.equal(def.style, '');
  const own = mod.buildNpcAvatarPromptParts(
    { gender: '女', age: 28, appearancePrompt: '黑色齐肩发' },
    { workStyle: '水墨国风' },
  );
  assert.equal(own.style, '水墨国风');
  for (const k of ['style', 'subject', 'negative']) assert.equal(typeof def[k], 'string');
  assert.doesNotMatch(def.subject, /二次元写实漫/);
  assert.doesNotMatch(mod.composePositivePrompt(def), /二次元写实漫/);
  assert.match(mod.composePositivePrompt(def), /黑色齐肩发/);
  assert.doesNotMatch(mod.composePositivePrompt(def), /水印|畸形手指/);
  assert.match(mod.ART_STYLE_PLACEHOLDER, /选填：可写画风/);
});
test('editorImagePrompts_人物主体只写外观_不混关系剧情小传_缺外观按性别年龄给脚手架', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  const withLook = mod.buildNpcAvatarPromptParts({
    gender: '女',
    age: 52,
    appearancePrompt: '灰白短发，方脸，围裙',
    // 功能注释：旧调用多余字段不得进主体
    bio: '后厨掌勺十几年，与你是房东关系',
    relation: '房东',
  });
  assert.match(withLook.subject, /灰白短发/);
  assert.doesNotMatch(withLook.subject, /后厨掌勺|房东|关系|小传/);
  assert.match(withLook.subject, /1:1/);

  // 缺 appearancePrompt：性别 + 年龄搭脚手架，发型/面容/衣着留给创作者
  const scaffold = mod.buildNpcAvatarPromptParts({ gender: '男', age: 17 });
  assert.match(scaffold.subject, /男/);
  assert.match(scaffold.subject, /17/);
  assert.match(scaffold.subject, /发型/);
  assert.match(scaffold.subject, /衣着/);
  // 功能注释：脚手架里没填的「标签：」空段，组装正向时要剔除，不原样发给模型
  const positive = mod.composePositivePrompt(scaffold);
  assert.doesNotMatch(positive, /发型发色：|衣着配饰：|脸型五官气质：/);
  assert.match(positive, /男/);

  const empty = mod.buildNpcAvatarPromptParts({});
  assert.equal(empty.subject, '');
  assert.equal(mod.composePositivePrompt(empty), '');
  assert.equal(mod.buildNpcAvatarPrompt({}), '');
});

test('editorImagePrompts_地点只用画面描述_不用进入叙事desc_大地图含地点名_封面不含标题文字', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  const scene = mod.buildLocationScenePromptParts({
    name: '旅馆前院',
    scenePrompt: '石板路湿漉漉，两侧是木格窗',
    // 功能注释：desc 是玩家进入时读的叙事，不得进场景主体
    desc: '你推门而入，心里有些不安，老板娘抬头看了你一眼。',
  });
  assert.match(scene.subject, /旅馆前院/);
  assert.match(scene.subject, /石板路/);
  assert.match(scene.subject, /9:16/);
  assert.doesNotMatch(scene.subject, /你推门而入|不安|老板娘/);
  assert.equal(mod.buildLocationScenePromptParts({}).subject, '');
  assert.equal(mod.buildLocationScenePrompt({}), '');

  const map = mod.buildWorldMapPromptParts({ name: '皇宫', places: ['寝宫', '御花园', ''] });
  assert.match(map.subject, /皇宫/);
  assert.match(map.subject, /寝宫/);
  assert.match(map.subject, /御花园/);
  assert.match(map.subject, /9:16/);
  // 功能注释：空输入仍给出「按设定补分区」脚手架，不再返回空串
  assert.match(mod.buildWorldMapPromptParts({}).subject, /按设定补分区/);

  const cover = mod.buildWorkCoverPromptParts({
    title: '雾色旅馆',
    summary: '一座雨夜旅馆里的继承故事',
    protagonistAppearance: '黑色长发的年轻女子，风衣',
  });
  assert.match(cover.subject, /继承故事/);
  assert.match(cover.subject, /黑色长发/);
  assert.match(cover.subject, /9:16/);
  // 功能注释：作品名不写进画面；标题文字进负面词
  assert.doesNotMatch(cover.subject, /雾色旅馆/);
  assert.match(cover.negative, /标题文字/);
  assert.equal(mod.buildWorkCoverPromptParts({}).subject, '');
  assert.equal(mod.buildWorkCoverPrompt({}), '');
  // 有氛围但没填主角外观：空槽「主角外观：」组装时剔除
  const bare = mod.buildWorkCoverPromptParts({ summary: '雨夜旅馆' });
  assert.doesNotMatch(mod.composePositivePrompt(bare), /主角外观：/);
});

test('editorImagePrompts_负面词独立字段_合并作品负面词与forbidGen且去重_不进正向', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  const parts = mod.buildLocationScenePromptParts(
    { name: '教室', scenePrompt: '木课桌，黑板，窗外梧桐' },
    { workNegative: '血腥，水印', forbidGen: '现代手机，血腥' },
  );
  assert.match(parts.negative, /血腥/);
  assert.match(parts.negative, /现代手机/);
  assert.match(parts.negative, /水印/);
  assert.equal(parts.negative.split('，').filter((x) => x === '血腥').length, 1, '血腥只出现一次');
  const positive = mod.composePositivePrompt(parts);
  assert.doesNotMatch(positive, /血腥|现代手机|水印/);
  assert.doesNotMatch(parts.subject, /血腥|现代手机/);

  assert.equal(mod.mergeNegativePrompt('a，b', 'b, c\nd'), 'a，b，c，d');
  assert.equal(mod.mergeNegativePrompt(undefined, '', null), '');
});

test('editorImagePrompts_请求尺寸与提示词构图一致_头像方图_场景地图封面9比16', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  const portrait = await import(pathToFileURL(join(romance, 'lib/scenePortrait.ts')).href);
  assert.equal(mod.NPC_AVATAR_GEN_SIZE, '1024x1024');
  assert.equal(mod.LOCATION_SCENE_GEN_SIZE, portrait.SCENE_PORTRAIT_GEN_SIZE);
  assert.equal(mod.WORLD_MAP_GEN_SIZE, portrait.SCENE_PORTRAIT_GEN_SIZE);
  assert.equal(mod.WORK_COVER_GEN_SIZE, portrait.SCENE_PORTRAIT_GEN_SIZE);
  assert.equal(portrait.SCENE_PORTRAIT_GEN_SIZE, '1080x1920');
  const avatar = mod.buildNpcAvatarPromptParts({ gender: '女', age: 20, appearancePrompt: '长发' });
  assert.match(avatar.subject, /1:1/);
  assert.doesNotMatch(avatar.subject, /9:16/);
  for (const subject of [
    mod.buildLocationScenePromptParts({ name: 'A', scenePrompt: 'x' }).subject,
    mod.buildWorldMapPromptParts({ name: 'M' }).subject,
    mod.buildWorkCoverPromptParts({ summary: 's' }).subject,
  ]) {
    assert.match(subject, /9:16/);
  }
});

test('editorImagePrompts_作品级画风负面词存取_空画风不存_基线负面词不存', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  assert.equal(mod.workImageGenFromParts({ style: '', negative: '文字，水印，UI，人物特写' }), undefined);
  assert.deepEqual(mod.workImageGenFromParts({ style: '水墨国风', negative: '文字，水印，现代建筑' }), {
    style: '水墨国风',
    negative: '现代建筑',
  });
  assert.deepEqual(mod.workImageGenFromParts({ style: '水墨国风', negative: '现代建筑，血腥' }, '血腥'), {
    style: '水墨国风',
    negative: '现代建筑',
  });
  const settings = mod.workImageSettingsOf({ style: '像素风', negative: '模糊' }, '血腥');
  assert.deepEqual(settings, { workStyle: '像素风', workNegative: '模糊', forbidGen: '血腥' });
  assert.equal(mod.buildWorldMapPromptParts({ name: 'M' }, settings).style, '像素风');
  // 功能注释：脏数据（对象）不得变成 [object Object]，画风留空
  const dirty = mod.workImageSettingsOf({ style: { a: 1 }, negative: 3 });
  assert.equal(mod.buildWorldMapPromptParts({ name: 'M' }, dirty).style, '');
});

test('世界生成_不调用任何生图接口_也不在结尾批量生图', () => {
  const gen = read('lib/worldGenGenerate.ts');
  const wiz = read('components/WorldGenWizard.tsx');
  const sess = read('lib/worldGenSession.ts');
  for (const src of [gen, wiz, sess]) {
    assert.doesNotMatch(src, /generatePlatformImage|generateImageViaPlatform|platformImageGen|generateImage\(/);
    assert.doesNotMatch(src, /AiImageGen|ImagePicker/);
    assert.doesNotMatch(src, /images\/generate/);
  }
  // 功能注释：生成世界可以写外观提示词文字，留给编辑器里单张生图再用
  assert.match(gen, /appearancePrompt/);
  assert.match(gen, /scenePrompt/);
});

test('类型与编辑器_人物appearancePrompt_地点scenePrompt_作品imageGen分字段', () => {
  const content = read('worlds/star2005/content.ts');
  assert.match(content, /appearancePrompt\?: string/);
  assert.match(content, /scenePrompt\?: string/);
  const types = read('mods/types.ts');
  assert.match(types, /imageGen\?: \{ style\?: string; negative\?: string \}/);
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /n\.appearancePrompt/);
  assert.match(panel, /appearancePrompt: e\.target\.value/);
  const rooms = read('components/ModRoomTreeEditor.tsx');
  assert.match(rooms, /scenePrompt: e\.target\.value/);
  assert.match(rooms, /r\.scenePrompt/);
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

test('AiImageGen_三层可编辑_正向画风加主体_负面词单独传_重绘默认带当前图', () => {
  const gen = read('components/AiImageGen.tsx');
  assert.match(gen, /initialParts/);
  assert.match(gen, /initialRefs/);
  assert.match(gen, /画风 · 整部作品统一/);
  assert.match(gen, /本张主体 · 只写这一张/);
  assert.match(gen, /负面词 · 不想出现的内容/);
  assert.match(gen, /composePositivePrompt\(\{ style, subject \}\)/);
  assert.match(gen, /negativePrompt: negative\.trim\(\) \|\| undefined/);
  assert.match(gen, /onPartsCommit/);
  // 功能注释：参考图初始值取 initialRefs 前 MAX_REFS 张，创作者可移除
  assert.match(gen, /useState<string\[\]>\(\(\) => \(initialRefs \?\? \[\]\)\.filter\(Boolean\)\.slice\(0, MAX_REFS\)\)/);
  assert.match(gen, /已默认带入当前图，可移除/);
});

test('ImagePicker_透传三层与初始参考图', () => {
  const picker = read('components/ImagePicker.tsx');
  assert.match(picker, /initialParts\?: EditorImagePromptParts/);
  assert.match(picker, /initialRefs\?: string\[\]/);
  assert.match(picker, /initialParts=\{genOpts\.initialParts\}/);
  assert.match(picker, /initialRefs=\{genOpts\.initialRefs\}/);
  assert.match(picker, /onPartsCommit=\{genOpts\.onPartsCommit\}/);
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

test('人物卡_生图用外观描述三层_重绘默认带当前头像', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /buildNpcAvatarPromptParts/);
  assert.match(panel, /from ["']\.\.\/lib\/editorImagePrompts["']/);
  assert.match(panel, /<AiImageGen[\s\S]*initialParts=\{buildNpcAvatarPromptParts/);
  assert.match(panel, /appearancePrompt: n\.appearancePrompt/);
  // 功能注释：头像生图主体不再喂小传 / 关系
  assert.doesNotMatch(panel, /initialParts=\{buildNpcAvatarPromptParts\([\s\S]{0,260}bio: n\.bio/);
  assert.match(panel, /size=\{NPC_AVATAR_GEN_SIZE\}/);
  assert.match(panel, /initialRefs=\{n\.avatar \? \[n\.avatar\] : undefined\}/);
  assert.match(panel, /n\.avatar/);
  const content = read('worlds/star2005/content.ts');
  assert.match(content, /avatar\?: string/);
  assert.match(content, /summary\?: string/);
  const store = read('lib/store.ts');
  assert.match(store, /p\.avatar/);
  assert.match(store, /drawAvatar/);
});

test('大地图与地点_接同一套竖版生图', () => {
  const rooms = read('components/ModRoomTreeEditor.tsx');
  assert.match(rooms, /buildWorldMapPromptParts/);
  assert.match(rooms, /buildLocationScenePromptParts/);
  assert.match(rooms, /大地图图/);
  assert.match(rooms, /patchMap\(curMap\.id, \{ bg:/);
  assert.match(rooms, /LOCATION_SCENE_GEN_SIZE/);
  assert.match(rooms, /WORLD_MAP_GEN_SIZE/);
  assert.match(rooms, /scenePortrait/);
  assert.match(rooms, /initialParts: buildLocationScenePromptParts/);
  assert.match(rooms, /size: LOCATION_SCENE_GEN_SIZE/);
  // 功能注释：场景生图用画面描述 scenePrompt，不用进入叙事 desc
  assert.match(rooms, /\{ name: r\.name, scenePrompt: r\.scenePrompt \}/);
  assert.doesNotMatch(rooms, /buildLocationScenePromptParts\(\s*\{[^}]*desc: r\.desc/);
  assert.doesNotMatch(rooms, /1792x1024/);
});

test('作品封面_生图三层_氛围加主角外观_尺寸与9比16一致', () => {
  const cover = read('components/CoverDiyPanel.tsx');
  assert.match(cover, /buildWorkCoverPromptParts/);
  assert.match(cover, /workTitle/);
  assert.match(cover, /workSummary/);
  assert.match(cover, /initialParts: buildWorkCoverPromptParts/);
  assert.match(cover, /size: WORK_COVER_GEN_SIZE/);
  assert.doesNotMatch(cover, /1024x1792/);
  const opening = read('components/ModOpeningEditor.tsx');
  assert.match(opening, /workTitle/);
  assert.match(opening, /workSummary/);
  assert.match(opening, /imageGen=\{imageGen\}/);
  const panel = read('components/ModEditorPanel.tsx');
  assert.match(panel, /workTitle=\{m\.name\}/);
  assert.match(panel, /workSummary=\{m\.description\}/);
  assert.match(panel, /imageGen=\{imageGenBinding\}/);
  assert.match(panel, /workImageGenFromParts/);
});

test('platformImageGen_登录优先平台API_未登录才个人Key', () => {
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /\/api\/romance\/images\/generate/);
  assert.match(src, /generateImageViaPlatform/);
  assert.match(src, /hasPlatformPlayAuth\(\)/);
  assert.match(src, /return generateImage\(cfg, appendNegativeSection\(prompt, options\.negativePrompt\), size\)/);
  assert.match(src, /editorImageGenerateUrl/);
  // 功能注释：禁止再只认个人 AI 配置
  assert.match(src, /hasPlatformPlayAuth\(\) \|\| imageConfigured\(cfg\)/);
  assert.doesNotMatch(src, /还没配置生图模型：去「设置/);
});

test('platformImageGen_负面词单独字段加末尾标注段_空负面词不追加', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/editorImagePrompts.ts')).href);
  assert.equal(mod.appendNegativeSection('画风。主体', ''), '画风。主体');
  assert.equal(mod.appendNegativeSection('画风。主体', undefined), '画风。主体');
  const out = mod.appendNegativeSection('画风。主体', '文字，水印');
  assert.match(out, /^画风。主体\n\n【负面词·避免出现】文字，水印$/);
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /negativePrompt\?: string/);
  assert.match(src, /\.\.\.\(negativePrompt \? \{ negativePrompt \} : \{\}\)/);
});
