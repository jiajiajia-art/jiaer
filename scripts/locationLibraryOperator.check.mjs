/**
 * 运营后台地点库入口 + API 客户端契约。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('OperatorPanel_应有地点库页签与路由', () => {
  const panel = read('src/page/operator/OperatorPanel.tsx');
  assert.match(panel, /locations/);
  assert.match(panel, /AdminLocationLibraryManager/);
  assert.match(panel, /\/operator\/locations/);
  assert.match(panel, /label: '地点库·大地图'/);
  const app = read('src/App.tsx');
  assert.match(app, /path="\/operator\/locations"/);
});

test('AdminLocationLibraryManager_应支持大地图树与启停', () => {
  const src = read('src/components/admin/AdminLocationLibraryManager.tsx');
  assert.match(src, /locationLibraryApi\.create/);
  assert.match(src, /locationLibraryApi\.update/);
  assert.match(src, /locationLibraryApi\.disable/);
  assert.match(src, /locationLibraryApi\.upload/);
  assert.match(src, /大地图/);
  assert.match(src, /treeJson/);
  assert.match(src, /地点树 JSON/);
  assert.doesNotMatch(src, /\balert\s*\(/);
});

test('locationLibraryApi_路径契约含treeJson', () => {
  const src = read('src/api/galgame/locationLibrary.ts');
  assert.match(src, /\/api\/location-library/);
  assert.match(src, /\/disable/);
  assert.match(src, /\/enable/);
  assert.match(src, /\/upload/);
  assert.match(src, /treeJson/);
});
