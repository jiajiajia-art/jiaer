/**
 * 创作游戏三分法：游戏世界 / 玩法 Mod / 手机应用（需求 Romance/docs/玩法Mod与手机应用-需求.md §3）
 * 覆盖 C0 文案与无 SDK 误导、C1 世界生成不自动装、P1 安装→叠加链、P3 目录不含应用、P4 空列表=没装、P5 桌面画平台应用、P0 安装面板只安装。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(root, p), 'utf8');
const load = (p) => import(pathToFileURL(join(root, p)).href);

const createType = read('src/page/CreateType.tsx');
const shell = read('Romance/src/components/PlayModCreateShell.tsx');
const createApp = read('src/page/CreatePlatformApp.tsx');

/** 功能注释：创作者不得被暗示拥有 / 生成 / 上传自己的 SDK */
const BAD_SDK_LANG = /产出专属\s*SDK|不产出专属\s*SDK|生成\s*SDK|保存并生成\s*SDK|保存草稿并生成\s*SDK|上传\s*SDK|SDK\s*上传|专属\s*SDK/;

test('C0_创作游戏弹窗文案与需求原文一致', () => {
  assert.ok(
    createType.includes('选择要创作的类型。游戏世界走现有逻辑。玩法 Mod 和手机应用用对话生成，都运行在平台 SDK 上。'),
  );
  assert.ok(createType.includes('填写设定，AI 搭建世界，再进编辑器细调'));
  assert.ok(
    createType.includes(
      '对话生成玩法叠加包。可以是新地点、游戏内页面，或填进已有玩法格子的数据。可绑多个游戏世界，也可分多次安装。用平台 SDK。',
    ),
  );
  assert.ok(
    createType.includes('对话生成应用草稿，审核通过后上架，供游戏世界里的手机安装。用平台 SDK。'),
  );
  // 三条入口各自走各自的创作路径
  assert.match(createType, /createRomance\(\)/);
  assert.match(createType, /createPlayMod=1/);
  assert.match(createType, /navigate\('\/create\/app'\)/);
});

test('C0_三处入口文案不得出现生成或拥有专属SDK', () => {
  for (const [name, src] of [
    ['CreateType', createType],
    ['PlayModCreateShell', shell],
    ['CreatePlatformApp', createApp],
  ]) {
    assert.doesNotMatch(src, BAD_SDK_LANG, `${name} 仍含误导性 SDK 文案`);
  }
  // 上传按钮写「玩法包 / 应用草稿」
  assert.match(shell, /上传玩法包/);
  assert.doesNotMatch(shell, /请先登录后再上传 SDK/);
  assert.match(createApp, /上传应用草稿/);
  assert.match(createApp, /保存草稿/);
});

test('C0_误导文案检测器_能抓住旧写法', () => {
  for (const bad of ['保存并生成 SDK', '保存草稿并生成 SDK', '生成 SDK', '不产出专属 SDK', '请先登录后再上传 SDK', 'SDK 上传失败']) {
    assert.match(bad, BAD_SDK_LANG, bad);
  }
  assert.doesNotMatch('应用运行在平台 SDK 上', BAD_SDK_LANG);
});

test('C1_世界生成草稿不自动写玩法安装与手机应用', async () => {
  const wiz = await load('Romance/src/lib/worldGenWizard.ts');
  const draft = wiz.draftModFromWorldGen({
    title: '雾港来信',
    setting: '玩家继承海边旅店。娱乐圈 直播 咸鱼 论坛 怀孕 座驾',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: [...wiz.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
  });
  assert.equal(draft.content.playModInstalls, undefined);
  assert.equal(draft.content.phoneAppsCfg, undefined);
  assert.deepEqual(draft.dependencies, []);
  // 玩法 / 应用相关步骤都不是世界生成可勾选的核心项
  for (const id of ['playModInstalls', 'phoneAppsCfg', 'hub:mods']) {
    assert.equal(wiz.isWorldGenCoreStep(id), false, id);
  }
  // 旧草稿里勾了玩法安装 → 被丢弃，不会变成生成项
  const s1 = wiz.normalizeWorldGenStep1({
    title: 't',
    setting: 's',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: ['prompt', 'playModInstalls', 'phoneAppsCfg'],
  });
  assert.ok(!s1.editorStepIds.includes('playModInstalls'));
  assert.ok(!s1.editorStepIds.includes('phoneAppsCfg'));
});

test('C1_AI补丁即使勾选玩法安装步骤也剥离playModInstalls与phoneAppsCfg', async () => {
  const gen = await load('Romance/src/lib/worldGenGenerate.ts');
  const patch = {
    npcs: [],
    playModInstalls: [{ slug: 'pack-career' }],
    phoneAppsCfg: [{ id: 'wechat' }],
  };
  for (const steps of [['npcs'], ['playModInstalls'], ['npcs', 'playModInstalls', 'phoneAppsCfg']]) {
    const cleaned = gen.sanitizeWorldGenBatchPatch(steps, patch);
    assert.equal(cleaned.playModInstalls, undefined, steps.join(','));
    assert.equal(cleaned.phoneAppsCfg, undefined, steps.join(','));
  }
});

test('C1_向导源码不调用目录安装或推荐写入', () => {
  const wizUi = read('Romance/src/components/WorldGenWizard.tsx');
  const wizLib = read('Romance/src/lib/worldGenWizard.ts');
  for (const src of [wizUi, wizLib]) {
    assert.doesNotMatch(src, /makeInstallFromCatalog|recommendPlayModsFromSetting|LOCAL_PLAY_MOD_CATALOG/);
    assert.doesNotMatch(src, /playModInstalls\s*[:=]\s*\[/);
    assert.doesNotMatch(src, /phoneAppsCfg\s*[:=]\s*\[\s*\{/);
  }
});

test('P3_添加玩法目录不含论坛视频直播咸鱼等手机应用', async () => {
  const cat = await load('Romance/src/mods/playModCatalog.ts');
  assert.ok(cat.LOCAL_PLAY_MOD_CATALOG.length >= 9);
  for (const item of cat.LOCAL_PLAY_MOD_CATALOG) {
    assert.equal(item.componentKind, 'gameplay', item.slug);
    assert.equal(item.phoneAppId, undefined, item.slug);
    assert.deepEqual(item.editorPanels.filter((p) => p === 'phoneApp'), [], item.slug);
  }
  const slugs = cat.LOCAL_PLAY_MOD_CATALOG.map((x) => x.slug);
  const names = cat.LOCAL_PLAY_MOD_CATALOG.map((x) => x.name).join('|');
  for (const bad of ['app-forum', 'app-video-live', 'app-xianyu']) {
    assert.ok(!slugs.includes(bad), bad);
    assert.equal(cat.catalogBySlug(bad), undefined, bad);
  }
  assert.doesNotMatch(names, /论坛|直播|咸鱼/);
  // 推荐也不得推应用
  const recs = cat
    .recommendPlayModsFromSetting('娱乐圈明星 直播带货 二手咸鱼 论坛 饭圈 通告')
    .map((x) => x.slug);
  assert.ok(recs.includes('pack-career'));
  assert.ok(recs.every((s) => !s.startsWith('app-')), recs.join(','));
  // 官方 9 个玩法仍在
  for (const s of ['pack-career', 'pack-image', 'pack-paper', 'pack-transport', 'pack-cars', 'pack-pregnancy', 'pack-living', 'pack-titles', 'pack-relations']) {
    assert.ok(slugs.includes(s), s);
  }
});

test('P0_安装面板只安装_不在世界里新建应用或混装', () => {
  const modal = read('Romance/src/components/AddPlayModModal.tsx');
  const editor = read('Romance/src/components/PhoneAppsEditor.tsx');
  assert.match(modal, /componentKind === "gameplay"/);
  assert.doesNotMatch(modal, /createPlatformApp|savePlatformApp|upsertPlatformApp|phoneAppsCfg/);
  assert.doesNotMatch(editor, /createPlatformApp|savePlatformApp|upsertPlatformApp|create\/app/);
  assert.match(editor, /listPublishedPlatformApps/);
  assert.match(editor, /compactInstalledAppIds/);
  // 未装的旧作品（字段缺失）编辑器必须与运行时一致展示 11 个官方应用，不能把 undefined 当 []
  assert.match(editor, /installedPlatformAppIds\(value\)/);
  assert.doesNotMatch(editor, /installedPlatformAppIds\(value \?\? \[\]\)/);
});

test('P4_空数组表示没装_字段缺失才是旧作品预装11个', async () => {
  const cfg = await load('Romance/src/lib/phoneAppsConfig.ts');
  assert.deepEqual(cfg.normalizeWorldPhoneAppsCfg([]), []);
  assert.deepEqual(cfg.normalizeWorldPhoneAppsCfg({ apps: [] }), []);
  assert.equal(cfg.normalizeWorldPhoneAppsCfg(undefined), undefined);
  assert.equal(cfg.normalizeWorldPhoneAppsCfg(null), undefined);
  assert.deepEqual(cfg.normalizeWorldPhoneAppsCfg([{ id: 'wechat' }]), [{ id: 'wechat' }]);
  assert.deepEqual(cfg.normalizeWorldPhoneAppsCfg({ apps: [{ id: 'sms' }] }), [{ id: 'sms' }]);

  assert.deepEqual(cfg.installedPlatformAppIds([]), []);
  assert.equal(cfg.installedPlatformAppIds(undefined).length, 11);
  assert.deepEqual(cfg.compactInstalledAppIds([]), []);
  // 写入只留编号，卸光后仍是 []（不是 undefined）
  assert.deepEqual(cfg.compactInstalledAppIds(['wechat']).map((x) => x.id), ['wechat']);
});

test('P4_世界合并不得把空数组收成字段缺失', () => {
  const reg = read('Romance/src/mods/registry.ts');
  assert.match(reg, /normalizeWorldPhoneAppsCfg\(wc\.phoneAppsCfg\)/);
  assert.doesNotMatch(reg, /list\.length \? list\.map\(\(a\) => \(\{ \.\.\.a \}\)\) : undefined/);
});

test('P5_开局桌面只有商店设置_或已装编号含平台新应用', async () => {
  const cfg = await load('Romance/src/lib/phoneAppsConfig.ts');
  assert.deepEqual(cfg.preinstallIds([]), ['appstore', 'settings']);
  const withPlatform = cfg.preinstallIds([{ id: 'my-new-platform-app' }, { id: 'wechat' }]);
  assert.ok(withPlatform.includes('my-new-platform-app'));
  assert.ok(withPlatform.includes('wechat'));
  assert.ok(withPlatform.includes('appstore') && withPlatform.includes('settings'));
  assert.equal(cfg.preinstallIds(undefined).length, 13);

  const phone = read('Romance/src/components/Phone.tsx');
  // 首次生成桌面 / 桌面画图标都不再被内置 APP_IDS 白名单挡掉平台应用
  assert.doesNotMatch(phone, /preinstallIds\(worldPhoneAppsCfg\(\)\)\.filter\(\(id\) => APP_IDS\.has\(id\)\)/);
  assert.doesNotMatch(phone, /order\.filter\(\(x\) => isWidget\(x\) \|\| APP_IDS\.has\(x\)\)/);
  assert.match(phone, /preinstallIds\(worldPhoneAppsCfg\(\)\)/);
});

test('P1_世界玩法安装记录映射成叠加链_停用与手机应用不进链', async () => {
  const cat = await load('Romance/src/mods/playModCatalog.ts');
  const have = new Set(['pack-career', 'pack-image', 'pack-cars']);
  const ids = cat.resolveInstallAddonModIds(
    [
      { slug: 'pack-career', modId: 'pm-pack-career', enabled: true },
      { slug: 'pack-image', modId: 'pm-pack-image', enabled: false },
      { slug: 'pack-cars', modId: 'pm-pack-cars' },
      { slug: 'pack-career', modId: 'pm-pack-career' },
      { slug: 'not-installed-locally', modId: 'x' },
      { slug: 'some-app', modId: 'app-1', componentKind: 'phone_app' },
    ],
    (id) => have.has(id),
  );
  assert.deepEqual(ids, ['pack-career', 'pack-cars']);
  assert.deepEqual(cat.resolveInstallAddonModIds(undefined, () => true), []);
  assert.deepEqual(cat.resolveInstallAddonModIds([], () => true), []);
});

test('P1_娱乐圈自动补包只给内置娱乐圈_创作者世界不适用', async () => {
  const cat = await load('Romance/src/mods/playModCatalog.ts');
  assert.equal(cat.shouldAutoAttachEntPacks('ent'), true);
  assert.equal(cat.shouldAutoAttachEntPacks(undefined), true);
  assert.equal(cat.shouldAutoAttachEntPacks('ai-lq3k9x'), false);
  assert.equal(cat.shouldAutoAttachEntPacks('campus'), false);

  const reg = read('Romance/src/mods/registry.ts');
  // 预览 / 开局的叠加链读世界 playModInstalls，不只读 dependencies / 选择
  assert.match(reg, /resolveInstallAddonModIds\(world\.content\?\.playModInstalls/);
  assert.match(reg, /if \(s\.entSplit \|\| !shouldAutoAttachEntPacks\(s\.worldId\)\) return a;/);
  assert.match(reg, /if \(shouldAutoAttachEntPacks\(selection\.world\)\)/);
  assert.doesNotMatch(reg, /\(s\.worldId \?\? DEFAULT_WORLD\) !== DEFAULT_WORLD\) return a;[\s\S]{0,40}ENT_PACK_IDS/);
});
