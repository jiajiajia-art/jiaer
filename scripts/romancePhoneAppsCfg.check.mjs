/**
 * 模组编辑器：手机应用 — 平台表安装/卸下、作品只存 appId、禁止系统内置文案
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('ModEditorPanel_应保留手机应用配置入口', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /title="手机应用配置"/);
  assert.match(panel, /PhoneAppsEditor/);
  assert.match(panel, /phoneHomeWallpaper/);
  assert.match(panel, /onWallpaperChange/);
});

test('PhoneAppsEditor_只安装卸下_不新建_读平台已上架', () => {
  const ed = readFileSync(join(romance, 'components/PhoneAppsEditor.tsx'), 'utf8');
  assert.match(ed, /listPublishedPlatformApps/);
  assert.match(ed, /compactInstalledAppIds/);
  assert.match(ed, /安装/);
  assert.match(ed, /卸下/);
  assert.match(ed, /不会写入玩家正式存档|不写玩家正式存档/);
  assert.doesNotMatch(ed, /开局预装/);
  assert.doesNotMatch(ed, /setPreinstall|withAvail|AVAIL_OPTIONS/);
  assert.doesNotMatch(ed, /系统内置|手机自带应用/);
  assert.match(ed, /data-phone-apps-editor="v3-inphone-tabs"/);
  assert.match(ed, /data-phone-apps-compact="1"/);
  assert.match(ed, /data-phone-wallpaper-strip="1"/);
  assert.match(ed, /LivePhoneAppPreview/);
  assert.match(ed, /本作品已装应用/);
  assert.match(ed, /打开应用商店/);
});

test('phoneAppsConfig_作品只存已装appId_新旧兼容', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/phoneAppsConfig.ts')).href);
  assert.equal(mod.OFFICIAL_PLATFORM_APP_IDS.length, 11);
  assert.deepEqual(mod.installedPlatformAppIds(null), [...mod.OFFICIAL_PLATFORM_APP_IDS]);
  assert.deepEqual(mod.installedPlatformAppIds([]), []);
  assert.deepEqual(mod.installedPlatformAppIds([{ id: 'wechat' }, { id: 'sms' }]), ['wechat', 'sms']);
  assert.ok(mod.preinstallIds([]).includes('appstore'));
  assert.ok(!mod.preinstallIds([]).includes('wechat'));
  assert.ok(mod.preinstallIds([{ id: 'wechat' }]).includes('wechat'));
  const compacted = mod.compactInstalledAppIds(['wechat', 'appstore', 'sms', 'wechat']);
  assert.deepEqual(compacted, [{ id: 'wechat' }, { id: 'sms' }]);
  // 旧 avail 补丁仍可算出预装
  assert.ok(mod.installedPlatformAppIds([{ id: 'wechat', avail: 'store' }]).includes('sms'));
  assert.ok(!mod.installedPlatformAppIds([{ id: 'wechat', avail: 'store' }]).includes('wechat'));
});

test('Phone_App页读平台表_作者名_无系统内置', () => {
  const phone = readFileSync(join(romance, 'components/Phone.tsx'), 'utf8');
  const util = readFileSync(join(romance, 'components/phone/UtilApps.tsx'), 'utf8');
  assert.match(phone, /usePlatformAppsCatalog/);
  assert.match(phone, /platformToStoreItem/);
  assert.match(phone, /PlatformTypeApp/);
  assert.doesNotMatch(phone, /size: "系统内置"/);
  assert.doesNotMatch(phone, /kicker: "手机自带"/);
  assert.match(util, /去应用商店安装/);
  assert.match(util, /已安装/);
  assert.doesNotMatch(util, />手机自带应用</);
  assert.match(util, /authorName/);
});

test('AppDetail_不显示隐私信息表与推荐占位', () => {
  const util = readFileSync(join(romance, 'components/phone/UtilApps.tsx'), 'utf8');
  const detail = util.slice(util.indexOf('function AppDetail'), util.indexOf('function beep'));
  assert.match(detail, /d\.label/);
  assert.match(detail, /\{pill\}/);
  assert.doesNotMatch(detail, /App 隐私/);
  assert.doesNotMatch(detail, /未收集数据/);
  assert.doesNotMatch(detail, /你可能也喜欢/);
  assert.doesNotMatch(detail, /\["供应商"/);
  assert.doesNotMatch(detail, /年龄分级/);
  assert.doesNotMatch(detail, /H t="信息"/);
});

test('Phone_已装应用应写入存档私有键', () => {
  const phone = readFileSync(join(romance, 'components/Phone.tsx'), 'utf8');
  assert.match(phone, /star2005\.phone\.apps/);
  assert.match(phone, /saveData\(APPS_KEY/);
  assert.match(phone, /persistPrefs/);
  assert.match(phone, /loadApps/);
  assert.match(phone, /worldPhoneAppsCfg/);
  assert.match(phone, /Array\.isArray\(raw\.installed\) \? raw\.installed : defaultInstalled\(\)/);
});

test('worldGenWizard_手机应用配置不进AI勾选', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  assert.ok(!mod.ALL_WORLD_GEN_EDITOR_STEP_IDS.includes('phoneAppsCfg'));
});

test('platformApps_前端契约与创作入口', () => {
  const api = readFileSync(join(root, 'src/api/platform/platformAppsApi.ts'), 'utf8');
  const create = readFileSync(join(root, 'src/page/CreatePlatformApp.tsx'), 'utf8');
  const createType = readFileSync(join(root, 'src/page/CreateType.tsx'), 'utf8');
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(api, /\/api\/auth\/platform-apps/);
  assert.match(api, /publish/);
  assert.match(create, /创作应用/);
  assert.match(create, /上架/);
  assert.match(create, /AppPageShell/);
  assert.doesNotMatch(create, /<Navbar\s*\/>/);
  assert.doesNotMatch(create, /<MobileBottomNav/);
  assert.match(createType, /创作应用/);
  assert.match(app, /\/create\/app/);
  assert.match(app, /CreatePlatformApp/);
});
