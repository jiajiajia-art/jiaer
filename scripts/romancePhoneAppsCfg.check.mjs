/**
 * 模组编辑器：删除统一术语玩法表；手机应用配置精简为开局预装 + 存档隔离安装列表
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('ModEditorPanel_应删除术语玩法字段并保留底栏页签与手机应用配置', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /title="术语"/);
  assert.doesNotMatch(panel, /label: "城市名"/);
  assert.doesNotMatch(panel, /label: "货币"/);
  assert.doesNotMatch(panel, /label: "名气"/);
  assert.match(panel, /title="底栏页签"/);
  assert.match(panel, /title="手机应用配置"/);
  assert.match(panel, /PhoneAppsEditor/);
  assert.match(panel, /NAV_TAB_TERMS/);
});

test('PhoneAppsEditor_应仅保留开局预装并提供小手机预览', () => {
  const ed = readFileSync(join(romance, 'components/PhoneAppsEditor.tsx'), 'utf8');
  const live = readFileSync(join(romance, 'components/phone/LivePhoneAppPreview.tsx'), 'utf8');
  const peek = readFileSync(join(romance, 'components/phone/PeekApp.tsx'), 'utf8');
  const cfg = readFileSync(join(romance, 'lib/phoneAppsConfig.ts'), 'utf8');
  assert.match(ed, /应用商店/);
  assert.match(ed, /previewInstalled/);
  assert.match(ed, /不会写入正式存档/);
  // 功能注释：状态区只留开局预装勾选，禁止再出现可下载/条件解锁/隐藏/禁用入口
  assert.doesNotMatch(ed, /AVAIL_OPTIONS/);
  assert.match(ed, /开局预装/);
  assert.doesNotMatch(ed, />可下载</);
  assert.doesNotMatch(ed, />条件解锁</);
  assert.doesNotMatch(ed, />隐藏</);
  assert.doesNotMatch(ed, />禁用</);
  assert.doesNotMatch(ed, /解锁条件说明/);
  assert.match(ed, /avail: e\.target\.checked \? "preinstall" : "store"/);
  // 预览须挂载局内真实应用（含视监 PeekApp），禁止示意「首页/空状态/入口」
  assert.match(ed, /LivePhoneAppPreview/);
  assert.doesNotMatch(ed, /AppPreviewShell/);
  assert.doesNotMatch(ed, /这是「.*」首页预览/);
  assert.doesNotMatch(ed, /\["home", "首页"\]/);
  assert.match(live, /PeekApp/);
  assert.match(live, /WeChatApp/);
  assert.match(peek, /PeekEmptyShell/);
  // 预览须置顶，且机身/壁纸/Dock/灵动岛对齐局内实机 Phone.tsx
  assert.match(ed, /顶部：与实机一致的仿真机身预览/);
  assert.match(ed, /data-phone-apps-editor="v2-top-preview"/);
  assert.match(ed, /order-2/);
  assert.match(ed, /order-3/);
  assert.match(ed, /frameById/);
  assert.match(ed, /resolveWallpaper/);
  assert.match(ed, /DOCK_APPS/);
  assert.match(ed, /dynamic-island/);
  assert.match(ed, /aspect-\[9\/19\.5\]/);
  assert.doesNotMatch(ed, /预览桌面/);
  const previewIdx = ed.indexOf('顶部：与实机一致的仿真机身预览');
  const listIdx = ed.indexOf('下方：应用清单与属性');
  assert.ok(previewIdx >= 0 && listIdx > previewIdx, '小手机预览应排在应用清单上方');
  assert.ok(ed.indexOf('order-2') < ed.indexOf('order-3'), 'CSS order 亦保证预览在清单前');
  assert.match(cfg, /normalizePhoneAppAvail/);
  assert.match(cfg, /开局预装/);
});

test('phoneAppsConfig_旧状态归一与preinstall契约', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/phoneAppsConfig.ts')).href);
  const full = mod.resolvePhoneApps([{ id: 'wechat', label: '青信', avail: 'store' }]);
  const wx = full.find((a) => a.id === 'wechat');
  assert.equal(wx.label, '青信');
  assert.equal(wx.avail, 'store');
  // 旧五态：非 preinstall 一律商店可下
  assert.equal(mod.normalizePhoneAppAvail('locked'), 'store');
  assert.equal(mod.normalizePhoneAppAvail('hidden'), 'store');
  assert.equal(mod.normalizePhoneAppAvail('disabled'), 'store');
  assert.equal(mod.resolvePhoneApps([{ id: 'wechat', avail: 'hidden' }]).find((a) => a.id === 'wechat').avail, 'store');
  assert.ok(mod.preinstallIds().includes('appstore'));
  assert.ok(!mod.preinstallIds([{ id: 'wechat', avail: 'store' }]).includes('wechat'));
  assert.ok(!mod.preinstallIds([{ id: 'wechat', avail: 'disabled' }]).includes('wechat'));
  assert.equal(mod.compactPhoneApps(mod.resolvePhoneApps()), undefined);
  const c = mod.compactPhoneApps([{ id: 'notes', label: '手账', avail: 'preinstall' }]);
  assert.ok(c?.some((x) => x.id === 'notes' && x.label === '手账'));
  // 归一后目录应用一律可见（旧 hidden 不再永久藏起）
  assert.equal(mod.phoneAppVisible('wechat', [{ id: 'wechat', avail: 'hidden' }]), true);
  assert.equal(mod.phoneAppVisible('wechat', [{ id: 'wechat', avail: 'preinstall' }]), true);
  // 商店应包含未预装项
  assert.ok(mod.storeVisibleIds([{ id: 'wechat', avail: 'store' }]).includes('wechat'));
});

test('Phone_已装应用应写入存档私有键而非仅全局prefs', () => {
  const phone = readFileSync(join(romance, 'components/Phone.tsx'), 'utf8');
  assert.match(phone, /star2005\.phone\.apps/);
  assert.match(phone, /saveData\(APPS_KEY/);
  assert.match(phone, /persistPrefs/);
  assert.match(phone, /loadApps/);
  assert.match(phone, /worldPhoneAppsCfg/);
  assert.match(phone, /appLabel/);
  // 功能注释：有存档 installed 时不得因模组改预装而覆盖
  assert.match(phone, /Array\.isArray\(raw\.installed\) \? raw\.installed : defaultInstalled\(\)/);
});

test('worldGenWizard_术语模块改为底栏与手机应用', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const names = new Set(mod.WORLD_GEN_EDITOR_STEPS.map((s) => s.name));
  assert.ok(!names.has('术语'));
  assert.ok(names.has('底栏页签'));
  assert.ok(names.has('手机应用配置'));
});
