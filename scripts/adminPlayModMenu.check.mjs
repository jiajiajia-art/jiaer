/**
 * 运营后台须有【组件管理】入口（玩法 + 手机应用统一）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const admin = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const modal = readFileSync(join(root, 'Romance/src/components/AddPlayModModal.tsx'), 'utf8');
const catalog = readFileSync(join(root, 'Romance/src/mods/playModCatalog.ts'), 'utf8');
const sdk = readFileSync(join(root, 'Romance/src/mods/kkmod/sdk.ts'), 'utf8');

test('AdminPanel_应注册组件管理页签', () => {
  const nav = readFileSync(join(root, 'src/components/admin-shell/adminNavigation.tsx'), 'utf8');
  assert.match(admin, /components/);
  assert.match(admin, /AdminPlayModManager/);
  assert.match(admin, /\/admin\/components/);
  // 功能注释：侧栏文案迁入 AdminShell 导航配置，不再写死在 AdminPanel
  assert.match(nav, /label: '组件管理'/);
  assert.match(nav, /path: '\/admin\/components'/);
});

test('App_应注册components路由', () => {
  assert.match(app, /path="\/admin\/components"/);
  assert.match(app, /path="\/operator\/components"/);
});

test('OperatorPanel_运营中心侧栏须有组件管理', () => {
  const op = readFileSync(join(root, 'src/page/operator/OperatorPanel.tsx'), 'utf8');
  const nav = readFileSync(join(root, 'src/components/admin-shell/adminNavigation.tsx'), 'utf8');
  assert.match(op, /\/operator\/components/);
  assert.match(op, /AdminPlayModManager/);
  assert.match(nav, /label: '组件管理'/);
  assert.match(nav, /path: '\/operator\/components'/);
});

test('编辑器_玩法Mod统一安装入口_弹窗只列玩法', () => {
  assert.match(panel, /添加玩法/);
  assert.match(panel, /已添加的玩法|playModInstalls/);
  assert.match(modal, /玩法/);
  assert.match(modal, /setDetailSlug/);
  assert.match(modal, /添加（含依赖）/);
  assert.match(modal, /这里添加本作品要用的玩法/);
  assert.match(modal, /componentKind === "gameplay"/);
  // 功能注释：添加弹窗不再有分类切换/搜索；手机应用归应用商店
  assert.doesNotMatch(modal, /搜索玩法/);
  assert.doesNotMatch(modal, /\["all", "全部"\]/);
  assert.doesNotMatch(modal, /\["phone_app", "手机应用"\]/);
  assert.doesNotMatch(modal, />手机应用</);
  assert.match(catalog, /phone_app/);
  assert.match(catalog, /resolveInstalledPhoneAppIds/);
  assert.match(catalog, /previewImages/);
  assert.match(catalog, /detailDescription/);
});

test('kkmod_SDK只开放受控权限并禁止绕过支付', () => {
  assert.match(sdk, /KKMOD_ALLOWED_PERMISSIONS/);
  assert.match(sdk, /pay\.bypass/);
  assert.match(sdk, /save\.cross_game/);
  assert.match(sdk, /packKkmod/);
});
