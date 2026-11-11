/**
 * C2.2 手机应用分栏实时预览 + C0.2 适用题材：纯逻辑与页面接线断言。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const lib = await import(pathToFileURL(join(root, 'src/lib/platformAppThemes.ts')).href);

test('platformAppThemes_normalize_去重过滤非法并限上限', () => {
  assert.deepEqual(lib.normalizeThemeTagIds([1, '2', 2, 0, -1, 1.5, 'x']), [1, 2]);
  assert.deepEqual(lib.normalizeThemeTagIds('nope'), []);
  assert.equal(lib.normalizeThemeTagIds(Array.from({ length: 60 }, (_, i) => i + 1)).length, lib.PLATFORM_APP_THEME_MAX);
});

test('platformAppThemes_toggle_选中取消与非法id', () => {
  assert.deepEqual(lib.toggleThemeTagId([], 3), [3]);
  assert.deepEqual(lib.toggleThemeTagId([3, 4], 3), [4]);
  assert.deepEqual(lib.toggleThemeTagId([3], 0), [3]);
  const full = Array.from({ length: lib.PLATFORM_APP_THEME_MAX }, (_, i) => i + 1);
  assert.deepEqual(lib.toggleThemeTagId(full, 999), full);
});

test('platformAppThemes_validate_空题材阻止上架', () => {
  assert.equal(lib.validateApplicableThemesForPublish([]), '请至少选择 1 个适用题材');
  assert.equal(lib.validateApplicableThemesForPublish(undefined), '请至少选择 1 个适用题材');
  assert.equal(lib.validateApplicableThemesForPublish([2]), '');
});

test('platformAppThemes_readAppThemeTagIds_优先字段再回落content', () => {
  assert.deepEqual(lib.readAppThemeTagIds({ applicableThemeTagIds: [5] }), [5]);
  assert.deepEqual(lib.readAppThemeTagIds({ content: { applicableThemeTagIds: ['7'] } }), [7]);
  assert.deepEqual(lib.readAppThemeTagIds({ content: 'text' }), []);
});

test('CreatePlatformApp_分栏预览与题材多选接线', () => {
  const tsx = read('src/page/CreatePlatformApp.tsx');
  assert.match(tsx, /<PhoneAppLivePreview draft=\{previewDraft\}/);
  assert.match(tsx, /styles\.splitPreview/);
  assert.match(tsx, /applicableThemeTagIds: number\[\]/);
  assert.match(tsx, /useLocalizedThemeTags/);
  assert.match(tsx, /validateApplicableThemesForPublish/);
  assert.match(tsx, /pages: form\.pages/);
  assert.doesNotMatch(tsx, /\balert\(|window\.confirm|\bconfirm\(/);
  const preview = read('src/components/Create/PhoneAppLivePreview.tsx');
  assert.match(preview, /data-phone-app-live-preview/);
  const css = read('src/page/CreatePlatformApp.module.css');
  assert.match(css, /max-width:\s*1100px/);
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*position:\s*sticky/);
});

test('platformAppsApi_create_update带适用题材字段', () => {
  const api = read('src/api/platform/platformAppsApi.ts');
  assert.match(api, /applicableThemeTagIds\?: number\[\]/);
  assert.match(api, /applicableThemeTagIds: number\[\]/);
});
