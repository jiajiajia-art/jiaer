/**
 * 产品 7.2 / 2.7：音频库与画风库前端接线（API 客户端 + 运营菜单 + Romance 平台曲拉取）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('audioLibrary_API客户端应对齐运营接口路径', () => {
  const api = read('src/api/galgame/audioLibrary.ts');
  assert.match(api, /\/api\/audio-library/);
  assert.match(api, /\/api\/audio-library\/upload/);
  assert.match(api, /\/disable|\/enable/);
  assert.equal(existsSync(join(root, 'src/components/admin/AdminAudioLibraryManager.tsx')), true);
});

test('artStyleLibrary_API客户端应对齐运营接口路径', () => {
  const api = read('src/api/galgame/artStyleLibrary.ts');
  assert.match(api, /\/api\/art-style-library/);
  assert.match(api, /\/api\/art-style-library/);
  assert.match(api, /\/upload/);
  assert.equal(existsSync(join(root, 'src/components/admin/AdminArtStyleLibraryManager.tsx')), true);
});

test('OperatorPanel_素材中心应挂音频库与画风管理', () => {
  const panel = read('src/page/operator/OperatorPanel.tsx');
  const nav = read('src/components/admin-shell/adminNavigation.tsx');
  const app = read('src/App.tsx');
  assert.match(panel, /AdminAudioLibraryManager/);
  assert.match(panel, /AdminArtStyleManager/);
  assert.match(panel, /audioLibrary|artStyles/);
  assert.match(nav, /\/operator\/audio-library/);
  assert.match(nav, /\/operator\/art-styles/);
  assert.match(nav, /adminUi\.nav\.items\.assetCenter/);
  assert.match(read('src/i18n/locales/zh.json'), /"assetCenter": "素材中心"/);
  assert.match(app, /\/operator\/audio-library/);
  assert.match(app, /\/operator\/art-styles/);
});

test('Romance_platformAudio应拉取音频库并保留内置兜底', () => {
  const src = read('Romance/src/game/platformAudio.ts');
  assert.match(src, /\/api\/audio-library/);
  assert.match(src, /loadPlatformAudioFromApi/);
  assert.match(src, /PLATFORM_AUDIO_FALLBACK/);
  assert.match(src, /resolveFunloomApiBase/);
});
