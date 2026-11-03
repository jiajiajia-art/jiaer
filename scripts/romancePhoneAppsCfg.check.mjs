/**
 * 模组编辑器：手机应用配置 — 屏内编辑/预览、行点弹窗、应用商店开局预装、作品桌面背景
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
  assert.match(panel, /phoneHomeWallpaper/);
  assert.match(panel, /onWallpaperChange/);
  // 功能注释：手机应用配置页不向创作者展示「应用从哪添加」等内部规则说明
  const phoneSec = panel.slice(panel.indexOf('title="手机应用配置"'), panel.indexOf('title="皮肤美化"'));
  assert.doesNotMatch(phoneSec, /<Help>/);
  assert.doesNotMatch(phoneSec, /已添加的玩法/);
  assert.doesNotMatch(phoneSec, /论坛 \/ 直播 \/ 商城/);
});

test('PhoneAppsEditor_屏内切换_行点弹窗_商店预装_桌面背景', () => {
  const ed = readFileSync(join(romance, 'components/PhoneAppsEditor.tsx'), 'utf8');
  const live = readFileSync(join(romance, 'components/phone/LivePhoneAppPreview.tsx'), 'utf8');
  const peek = readFileSync(join(romance, 'components/phone/PeekApp.tsx'), 'utf8');
  const cfg = readFileSync(join(romance, 'lib/phoneAppsConfig.ts'), 'utf8');
  assert.match(ed, /应用商店/);
  assert.match(ed, /不会写入正式存档|不写玩家正式存档/);
  assert.match(ed, /开局预装/);
  assert.doesNotMatch(ed, /AVAIL_OPTIONS/);
  assert.doesNotMatch(ed, />可下载</);
  assert.doesNotMatch(ed, />条件解锁</);
  assert.doesNotMatch(ed, />隐藏</);
  assert.doesNotMatch(ed, />禁用</);
  assert.doesNotMatch(ed, /解锁条件说明/);
  // 功能注释：编辑/预览须贴在手机屏幕顶部，禁止机身外上方 Tab
  assert.match(ed, /data-phone-apps-editor="v3-inphone-tabs"/);
  assert.match(ed, /role="tablist"/);
  assert.match(ed, /\["edit", "编辑"\]/);
  assert.match(ed, /\["preview", "预览"\]/);
  assert.match(ed, /贴在手机屏幕顶部/);
  // 列表不在行内展开：点行弹 Modal
  assert.match(ed, /setEditId\(a\.id\)/);
  assert.match(ed, /Modal title=\{`编辑 · \$\{editing\.label\}`\}/);
  assert.doesNotMatch(ed, /expandedId|setExpanded/);
  // 应用商店弹窗改预装
  assert.match(ed, /setStoreOpen\(true\)/);
  assert.match(ed, /Modal title="应用商店"/);
  assert.match(ed, /setPreinstall/);
  assert.match(ed, /withAvail/);
  // 作品桌面背景上传
  assert.match(ed, /手机桌面背景/);
  assert.match(ed, /onWallpaperChange/);
  assert.match(ed, /resolveEffectiveHomeWallpaper/);
  // 预览须挂载局内真实应用
  assert.match(ed, /LivePhoneAppPreview/);
  assert.doesNotMatch(ed, /AppPreviewShell/);
  assert.doesNotMatch(ed, /这是「.*」首页预览/);
  assert.match(live, /PeekApp/);
  assert.match(live, /WeChatApp/);
  assert.match(peek, /PeekEmptyShell/);
  assert.match(ed, /frameById/);
  assert.match(ed, /DOCK_APPS/);
  assert.match(ed, /dynamic-island/);
  assert.match(ed, /aspect-\[9\/19\.5\]/);
  assert.match(ed, /应用清单与属性/);
  assert.match(cfg, /normalizePhoneAppAvail/);
  assert.match(cfg, /开局预装/);
});

test('PhoneAppsEditor_紧凑一屏_无创作者说明_点背景小条', () => {
  const ed = readFileSync(join(romance, 'components/PhoneAppsEditor.tsx'), 'utf8');
  // 页面表面不展示内部规则长说明（商店弹窗内仍可保留操作提示）
  assert.doesNotMatch(ed, /小手机实时预览（与局内实机同机身/);
  assert.doesNotMatch(ed, /实时预览 · 与游戏实机一致/);
  assert.doesNotMatch(ed, /应用商店里的获取 \/ 卸载只改作品开局预装/);
  assert.doesNotMatch(ed, /不改游戏场景背景，也不改手机外壳/);
  assert.doesNotMatch(ed, /预览与本作品游戏内手机桌面共用/);
  // 预览 / 点背景 / 清单收成连续一块
  assert.match(ed, /data-phone-apps-compact="1"/);
  assert.match(ed, /data-phone-wallpaper-strip="1"/);
  assert.doesNotMatch(ed, /order-1|order-2|order-3|order-4/);
  // 点背景：小预览条（约原 h-20 的三分之一）+ 旁侧上传/清除
  assert.match(ed, /h-7 min-w-0 flex-1/);
  assert.doesNotMatch(ed, /className="h-20 w-full/);
  assert.match(ed, /wallpaperPreviewCss/);
  const stripIdx = ed.indexOf('data-phone-wallpaper-strip="1"');
  const stripEnd = ed.indexOf('应用清单与属性', stripIdx);
  const stripBlock = ed.slice(stripIdx, stripEnd > stripIdx ? stripEnd : stripIdx + 1600);
  assert.match(stripBlock, /上传/);
  assert.match(stripBlock, /清除/);
  assert.match(stripBlock, /aria-label="桌面背景预览"/);
  assert.match(stripBlock, /type="file"/);
  // 顺序：机身 → 点背景条 → 应用清单（同一紧凑容器内）
  const phoneIdx = ed.indexOf('phone-frame');
  const wpIdx = ed.indexOf('data-phone-wallpaper-strip="1"');
  const listIdx = ed.indexOf('应用清单与属性');
  assert.ok(phoneIdx >= 0 && wpIdx > phoneIdx && listIdx > wpIdx, '预览→点背景→应用清单应连续排列');
});

test('phoneAppsConfig_旧状态归一与preinstall契约', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/phoneAppsConfig.ts')).href);
  const full = mod.resolvePhoneApps([{ id: 'wechat', label: '青信', avail: 'store' }]);
  const wx = full.find((a) => a.id === 'wechat');
  assert.equal(wx.label, '青信');
  assert.equal(wx.avail, 'store');
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
  assert.equal(mod.phoneAppVisible('wechat', [{ id: 'wechat', avail: 'hidden' }]), true);
  assert.equal(mod.phoneAppVisible('wechat', [{ id: 'wechat', avail: 'preinstall' }]), true);
  assert.ok(mod.storeVisibleIds([{ id: 'wechat', avail: 'store' }]).includes('wechat'));
});

test('phoneHomeWallpaper_作品默认与玩家覆盖解析', async () => {
  const wp = await import(pathToFileURL(join(romance, 'components/phone/wallpapers.ts')).href);
  const types = readFileSync(join(romance, 'mods/types.ts'), 'utf8');
  const reg = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');
  const phone = readFileSync(join(romance, 'components/Phone.tsx'), 'utf8');
  const settings = readFileSync(join(romance, 'components/phone/SettingsApp.tsx'), 'utf8');
  const sanit = readFileSync(join(romance, 'lib/sanitizeModStrings.ts'), 'utf8');
  assert.match(types, /phoneHomeWallpaper\?: string/);
  assert.match(reg, /worldPhoneHomeWallpaper/);
  assert.match(reg, /phoneHomeWallpaper: wc\.phoneHomeWallpaper/);
  assert.match(sanit, /phoneHomeWallpaper/);
  assert.match(phone, /resolveEffectiveHomeWallpaper\(worldPhoneHomeWallpaper\(\), prefs\)/);
  assert.match(phone, /wallpaperUserSet/);
  assert.match(settings, /wallpaperUserSet: true/);

  const worldCss = 'center/cover no-repeat url(data:image/png;base64,aaa)';
  const worldData = 'data:image/png;base64,bbb';
  // 未换过：用作品图
  const a = wp.resolveEffectiveHomeWallpaper(worldData, { wallpaper: 'flower' });
  assert.equal(a.id, 'world-home');
  assert.match(a.css, /bbb/);
  const b = wp.resolveEffectiveHomeWallpaper(worldCss, { wallpaper: 'flower' });
  assert.equal(b.css, worldCss);
  // 玩家主动换过：用玩家的
  const c = wp.resolveEffectiveHomeWallpaper(worldData, {
    wallpaper: 'flower',
    wallpaperUserSet: true,
  });
  assert.equal(c.id, 'flower');
  const d = wp.resolveEffectiveHomeWallpaper(worldData, {
    wallpaper: wp.CUSTOM_WALLPAPER_ID,
    customWallpaper: wp.customWallpaperCss('data:image/png;base64,player'),
    wallpaperUserSet: true,
  });
  assert.equal(d.id, wp.CUSTOM_WALLPAPER_ID);
  assert.match(d.css, /player/);
  // 无作品图：引擎默认
  const e = wp.resolveEffectiveHomeWallpaper(undefined, { wallpaper: 'flower' });
  assert.equal(e.id, 'flower');
  const f = wp.resolveEffectiveHomeWallpaper('  ', { wallpaper: 'flower' });
  assert.equal(f.id, 'flower');
});

test('Phone_已装应用应写入存档私有键而非仅全局prefs', () => {
  const phone = readFileSync(join(romance, 'components/Phone.tsx'), 'utf8');
  assert.match(phone, /star2005\.phone\.apps/);
  assert.match(phone, /saveData\(APPS_KEY/);
  assert.match(phone, /persistPrefs/);
  assert.match(phone, /loadApps/);
  assert.match(phone, /worldPhoneAppsCfg/);
  assert.match(phone, /appLabel/);
  assert.match(phone, /Array\.isArray\(raw\.installed\) \? raw\.installed : defaultInstalled\(\)/);
});

test('worldGenWizard_术语模块改为底栏_手机应用配置不进AI勾选', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const names = new Set(mod.WORLD_GEN_EDITOR_STEPS.map((s) => s.name));
  assert.ok(!names.has('术语'));
  assert.ok(names.has('底栏页签'));
  assert.ok(!names.has('手机应用配置'), '手机应用配置用默认，不进 AI 勾选');
  assert.ok(!mod.ALL_WORLD_GEN_EDITOR_STEP_IDS.includes('phoneAppsCfg'));
});
