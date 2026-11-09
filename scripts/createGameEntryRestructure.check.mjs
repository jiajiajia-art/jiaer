/**
 * 创作游戏入口重构：二级三项；列表无并列「创作应用」；
 * SDK 归平台，入口文案禁止「产出/专属 SDK」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('CreateType_创作游戏开二级_无并列创作应用', () => {
  const tsx = read('src/page/CreateType.tsx');
  assert.match(tsx, /romanceSubOpen/);
  assert.match(tsx, /游戏世界/);
  assert.match(tsx, /玩法 Mod/);
  assert.match(tsx, /手机应用/);
  assert.match(tsx, /createPlayMod=1/);
  assert.match(tsx, /\/create\/app/);
  assert.match(tsx, /createWorld=1&draftId=/);
  // 主列表不得再有单独一行 title="创作应用"
  assert.doesNotMatch(tsx, /title=["']创作应用["']/);
  // 创作应用入口应在二级弹层内（手机应用行）
  const subIdx = tsx.indexOf('romanceSubOpen');
  const phoneIdx = tsx.indexOf('title="手机应用"');
  assert.ok(subIdx >= 0 && phoneIdx > subIdx);
});

test('CreateType_二级弹窗文案_SDK归平台禁止产出专属', () => {
  const tsx = read('src/page/CreateType.tsx');
  const desc = tsx.match(/createTypeModalDesc[^>]*>\s*([\s\S]*?)<\/div>/)?.[1] ?? '';
  const playHint = tsx.match(/title="玩法 Mod"\s*hint="([^"]+)"/)?.[1] ?? '';
  const phoneHint = tsx.match(/title="手机应用"\s*hint="([^"]+)"/)?.[1] ?? '';
  assert.match(desc, /都运行在平台 SDK 上/);
  assert.match(playHint, /可以是新地点、游戏内页面，或填进已有玩法格子的数据/);
  assert.match(phoneHint, /供游戏世界里的手机安装。用平台 SDK/);
  for (const piece of [desc, playHint, phoneHint]) {
    assert.doesNotMatch(piece, /并产出专属 SDK|产出 SDK|专属 SDK/);
  }
});

test('PlayModCreateShell与手机应用页_禁止生成专属SDK话术', () => {
  const shell = read('Romance/src/components/PlayModCreateShell.tsx');
  const page = read('src/page/CreatePlatformApp.tsx');
  assert.match(shell, /能力都来自平台 SDK/);
  assert.match(shell, /上传玩法包到组件商店/);
  assert.doesNotMatch(shell, /生成专属 SDK/);
  // 功能注释：需求 C0 起不再写「不产出专属 SDK」这类否定句，直接改成上传应用草稿 + 运行在平台 SDK 上
  assert.doesNotMatch(page, /不产出专属 SDK|专属 SDK|生成 SDK/);
  assert.match(page, /上传应用草稿/);
  assert.match(page, /应用运行在平台 SDK 上/);
  assert.doesNotMatch(page, /自动产出专属/);
  assert.doesNotMatch(page, /已生成专属 SDK/);
});

test('PlayModCreateShell_复用工坊玩法模式并上传kkmod', () => {
  const shell = read('Romance/src/components/PlayModCreateShell.tsx');
  const app = read('Romance/src/App.tsx');
  const gate = read('Romance/src/lib/platformShellGate.ts');
  assert.match(shell, /forceMode=["']play["']/);
  assert.match(shell, /hideModeSwitch/);
  assert.match(shell, /kkmodPackageFromPlayMod|stringifyCreatorKkmod/);
  assert.match(shell, /kkmod\/upload|uploadPlayKkmod/);
  assert.match(app, /PlayModCreateShell/);
  assert.match(app, /createPlayMod/);
  assert.match(gate, /createPlayMod/);
});

test('CreatePlatformApp_对话生成与phone_app_SDK', () => {
  const page = read('src/page/CreatePlatformApp.tsx');
  assert.match(page, /手机应用/);
  assert.match(page, /创作应用/);
  assert.match(page, /data-phone-app-ai/);
  assert.match(page, /buildPhoneAppKkmodPackage/);
  assert.match(page, /uploadKkmod/);
  assert.match(page, /play\/complete|completePhoneAppChat/);
  assert.match(page, /保存草稿/);
  assert.match(page, /上架/);
});

test('platformAppKkmod_kind为phone_app', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/lib/platformAppKkmod.ts')).href);
  const pkg = mod.buildPhoneAppKkmodPackage({
    appId: 'demo-app',
    name: '演示应用',
    summary: '说明',
    type: 'browse',
  });
  assert.equal(pkg.manifest.kind, 'phone_app');
  assert.equal(pkg.manifest.phoneAppId, 'demo-app');
  assert.ok(pkg.payload.platformApp);
});

test('phoneAppAiChat_解析补丁与非法type回落', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/lib/phoneAppAiChat.ts')).href);
  const draft = {
    name: '旧名',
    summary: '',
    category: '',
    type: 'browse',
    contentText: '',
  };
  const patch = mod.extractPhoneAppJsonPatch(
    '好的。\n```json\n{"name":"闲潮","type":"browse","summary":"二手","contentText":"列表"}\n```',
  );
  assert.equal(patch?.name, '闲潮');
  const next = mod.applyPhoneAppAiPatch(draft, patch);
  assert.equal(next.name, '闲潮');
  assert.equal(next.type, 'browse');
  const bad = mod.applyPhoneAppAiPatch(draft, { name: 'x', type: 'hack' });
  assert.equal(bad.type, 'browse');
  assert.equal(mod.stripPhoneAppJsonFence('说明```json\n{}\n```尾'), '说明尾');
});

test('kkmodFromCreators_玩法与手机应用都能打包', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/kkmodFromCreators.ts')).href);
  const play = mod.kkmodPackageFromPlayMod({
    id: 'play-demo',
    name: '玩法演示',
    version: '0.1.0',
    author: 'u',
    description: 'd',
    kind: 'addon',
    content: {},
  });
  assert.equal(play.manifest.kind, 'gameplay');
  const phone = mod.kkmodPackageFromPhoneApp({
    appId: 'app1',
    name: '应用',
    summary: 's',
  });
  assert.equal(phone.manifest.kind, 'phone_app');
  assert.match(mod.stringifyCreatorKkmod(play), /gameplay|play-demo/);
});
