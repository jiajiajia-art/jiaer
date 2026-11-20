/**
 * 统一素材库：四 Tab、创作者上传、ImagePicker 走统一面板、生图进云端。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('CreatorAssetLibrary_四Tab与上传主按钮文案', () => {
  const src = read('components/CreatorAssetLibrary.tsx');
  assert.match(src, /上传头像/);
  assert.match(src, /上传地点整包/);
  assert.match(src, /上传地点图/);
  assert.match(src, /上传图片/);
  assert.match(src, /我的/);
  assert.match(src, /平台精选|公共\/系统/);
  assert.match(src, /发现本机头像/);
  assert.match(src, /保存到我的地点库/);
  assert.match(src, /已用于此处，并已保存到我的素材库/);
});

test('ImagePicker_素材库打开统一面板含我的', () => {
  const src = read('components/ImagePicker.tsx');
  assert.match(src, /CreatorAssetLibrary/);
  assert.match(src, /initialTab=\{platformAssetPurpose \? "locationImage" : "general"\}/);
  assert.match(src, /initialScope="mine"/);
  assert.doesNotMatch(src, /PlatformLocationAssetPicker/);
  assert.doesNotMatch(src, /setPlatformLibOpen\(true\)/);
});

test('ModEditorPanel_挂载统一素材库弹层', () => {
  const panel = read('components/ModEditorPanel.tsx');
  const picker = read('components/ImagePicker.tsx');
  assert.match(panel, /CreatorAssetLibrary/);
  assert.match(panel, /assetLibOpen/);
  assert.match(panel, /setAssetLibOpen\(false\)/);
  // 功能注释：顶栏直连入口下线后，由各 ImagePicker「素材库」按钮 setAssetLibOpen(true)
  assert.match(picker, /setAssetLibOpen\(true\)/);
  assert.match(picker, /CreatorAssetLibrary/);
});

test('ModRoomTreeEditor_从地点库走统一整包Tab', () => {
  const src = read('components/ModRoomTreeEditor.tsx');
  assert.match(src, /CreatorAssetLibrary/);
  assert.match(src, /initialTab="locationPack"/);
  assert.match(src, /onPickLocationPack=\{addFromLibrary\}/);
  assert.doesNotMatch(src, /listActivePlatformLocations/);
});

test('freeStyle_remember同步云端', () => {
  const src = read('lib/freeStyle.ts');
  assert.match(src, /syncRememberToCloud/);
  assert.match(src, /platformCreatorAssets/);
});

test('platformCreatorAssets_四类API', () => {
  const src = read('lib/platformCreatorAssets.ts');
  assert.match(src, /\/api\/avatar-library/);
  assert.match(src, /\/api\/location-library/);
  assert.match(src, /\/api\/location-asset-library/);
  assert.match(src, /\/api\/romance\/assets/);
  assert.match(src, /scope.*mine|scope: scope/);
});
