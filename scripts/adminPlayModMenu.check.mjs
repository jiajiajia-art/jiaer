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
  assert.match(admin, /components/);
  assert.match(admin, /组件管理/);
  assert.match(admin, /AdminPlayModManager/);
  assert.match(admin, /\/admin\/components/);
});

test('App_应注册components路由', () => {
  assert.match(app, /path="\/admin\/components"/);
  assert.match(app, /path="\/operator\/components"/);
});

test('OperatorPanel_运营中心侧栏须有组件管理', () => {
  const op = readFileSync(join(root, 'src/page/operator/OperatorPanel.tsx'), 'utf8');
  assert.match(op, /组件管理/);
  assert.match(op, /\/operator\/components/);
  assert.match(op, /AdminPlayModManager/);
});

test('编辑器_玩法Mod统一安装入口且含手机应用类型', () => {
  assert.match(panel, /添加玩法/);
  assert.match(panel, /已添加的玩法|playModInstalls/);
  assert.match(modal, /手机应用/);
  assert.match(modal, /玩法/);
  assert.match(catalog, /phone_app/);
  assert.match(catalog, /resolveInstalledPhoneAppIds/);
});

test('kkmod_SDK只开放受控权限并禁止绕过支付', () => {
  assert.match(sdk, /KKMOD_ALLOWED_PERMISSIONS/);
  assert.match(sdk, /pay\.bypass/);
  assert.match(sdk, /save\.cross_game/);
  assert.match(sdk, /packKkmod/);
});
