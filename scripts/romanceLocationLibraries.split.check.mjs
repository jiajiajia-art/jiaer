/**
 * 地点库 vs 地点素材库分离：整包树 vs 只换图；地点页布局与势力下线。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");

test("ModRoomTreeEditor_大地图按钮同行_无简介_素材库走平台用途", () => {
  const src = readFileSync(join(romance, "components/ModRoomTreeEditor.tsx"), "utf8");
  assert.match(src, /从地点库添加/);
  assert.match(src, /＋ 大地图/);
  // 功能注释：＋大地图与从地点库须与页签同一 flex 行，禁止再单独一行按钮区夹在页签与表单之间
  assert.doesNotMatch(src, /简介（可选）/);
  assert.doesNotMatch(src, /给创作者自己看的备注/);
  assert.match(src, /platformAssetPurpose="world_map"/);
  assert.match(src, /platformAssetPurpose="location_scene"/);
  assert.match(src, /作者库兰号/);
});

test("ImagePicker_平台素材库与本地库分离", () => {
  const src = readFileSync(join(romance, "components/ImagePicker.tsx"), "utf8");
  assert.match(src, /platformAssetPurpose/);
  assert.match(src, /PlatformLocationAssetPicker/);
  assert.match(src, /setPlatformLibOpen\(true\)/);
});

test("PlatformLocationAssetPicker_只选图不改结构", () => {
  const src = readFileSync(join(romance, "components/PlatformLocationAssetPicker.tsx"), "utf8");
  assert.match(src, /只换当前预览图/);
  assert.match(src, /listActivePlatformLocationAssets/);
  assert.doesNotMatch(src, /importLibraryMapTree/);
});

test("ModEditorPanel_地点页不再有势力整块", () => {
  const panel = readFileSync(join(romance, "components/ModEditorPanel.tsx"), "utf8");
  // 功能注释：势力放在「① 基础」建角下方、人物线路之前
  assert.match(panel, /<Section g="base" title="势力"/);
  assert.doesNotMatch(panel, /<Section g="role" title="势力"/);
  assert.ok(panel.indexOf('title="建角"') < panel.indexOf('title="势力"') && panel.indexOf('title="势力"') < panel.indexOf('title="人物线路"'), '势力须在建角之后、人物线路之前');
  assert.doesNotMatch(panel, /最多可选/);
  assert.doesNotMatch(panel, /＋ 新增势力/);
});

test("locationAssetLibrary_api与运营入口", () => {
  const api = readFileSync(join(root, "src/api/galgame/locationAssetLibrary.ts"), "utf8");
  assert.match(api, /\/api\/location-asset-library/);
  assert.match(api, /world_map|location_scene|cover/);
  const panel = readFileSync(join(root, "src/page/operator/OperatorPanel.tsx"), "utf8");
  const nav = readFileSync(join(root, "src/components/admin-shell/adminNavigation.tsx"), "utf8");
  // 功能注释：侧栏文案在 AdminShell 导航，面板负责挂载管理组件
  assert.match(nav, /label: '地点库'/);
  assert.match(nav, /label: '地点素材库'/);
  assert.match(panel, /AdminLocationAssetLibraryManager/);
  assert.match(panel, /\/operator\/location-assets/);
});
