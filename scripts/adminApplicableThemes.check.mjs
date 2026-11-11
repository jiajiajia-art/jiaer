/**
 * C2.1.2 运营后台适用题材改绑：纯逻辑 + 后台值覆盖官方种子 + 页面接线。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('applicableThemeTags_toggle_增删与非法id与上限', async () => {
  const m = await import(pathToFileURL(join(root, 'src/utils/applicableThemeTags.ts')).href);
  assert.deepEqual(m.toggleThemeTagId([1], 2), [1, 2]);
  assert.deepEqual(m.toggleThemeTagId([1, 2], 1), [2]);
  assert.deepEqual(m.toggleThemeTagId([1], 0), [1]);
  assert.deepEqual(m.toggleThemeTagId([1], -3), [1]);
  assert.deepEqual(m.toggleThemeTagId([1], 1.5), [1]);
  const full = Array.from({ length: m.MAX_APPLICABLE_THEME_TAGS }, (_, i) => i + 1);
  assert.equal(m.toggleThemeTagId(full, 999).length, m.MAX_APPLICABLE_THEME_TAGS);
  // 不改入参
  const src = [1];
  m.toggleThemeTagId(src, 2);
  assert.deepEqual(src, [1]);
});

test('applicableThemeTags_label与改绑校验', async () => {
  const m = await import(pathToFileURL(join(root, 'src/utils/applicableThemeTags.ts')).href);
  const tags = [{ id: 1, name: '现代' }, { id: 2, name: '古代' }];
  assert.equal(m.formatThemeTagLabels([1, 2], tags), '现代、古代');
  assert.equal(m.formatThemeTagLabels([1, 9], tags), '现代、#9');
  assert.equal(m.formatThemeTagLabels([], tags), '');
  assert.equal(m.formatThemeTagLabels(null, tags), '');
  assert.equal(m.validateThemeRebind([]), '请至少选择 1 个适用题材');
  assert.equal(m.validateThemeRebind([3]), null);
});

test('officialTheme_后台返回题材id时覆盖官方种子', async () => {
  const theme = await import(pathToFileURL(join(root, 'Romance/src/lib/officialThemeApplicability.ts')).href);
  const tags = [{ id: 1, name: '现代' }, { id: 2, name: '古代' }];
  // 后台改绑到古代：即使种子是 modern 也以后台为准
  assert.deepEqual(theme.resolveEffectiveApplicableThemeTagIds([2], ['modern'], tags), [2]);
  // 去重并丢弃非法值
  assert.deepEqual(theme.resolveEffectiveApplicableThemeTagIds([2, 2, 0, -1], ['modern'], tags), [2]);
  // 后台空 / 缺失 → 回退种子
  assert.deepEqual(theme.resolveEffectiveApplicableThemeTagIds([], ['modern'], tags), [1]);
  assert.deepEqual(theme.resolveEffectiveApplicableThemeTagIds(undefined, ['universal'], tags), [1, 2]);
  // 种子也解析不出 → null（调用方须打日志）
  assert.equal(theme.resolveEffectiveApplicableThemeTagIds(null, ['ancient'], [{ id: 1, name: '现代' }]), null);
});

test('adminPlayModManager_挂载应用区块与玩法改绑且复用单次题材请求', () => {
  const mgr = readFileSync(join(root, 'src/components/admin/AdminPlayModManager.tsx'), 'utf8');
  assert.match(mgr, /AdminPlatformAppsSection/);
  assert.match(mgr, /setApplicableThemes/);
  assert.equal((mgr.match(/getPublicTags\(/g) || []).length, 1);
  const section = readFileSync(join(root, 'src/components/admin/AdminPlatformAppsSection.tsx'), 'utf8');
  assert.doesNotMatch(section, /getPublicTags/);
  assert.match(section, /platformAppsAdminApi\.setApplicableThemes/);
  assert.match(section, /platformAppsAdminApi\.audit/);
  assert.doesNotMatch(`${mgr}${section}`, /\b(alert|confirm|prompt)\(/);
  const api = readFileSync(join(root, 'src/api/platform/platformAppsApi.ts'), 'utf8');
  assert.match(api, /\/api\/admin\/platform-apps/);
  assert.match(api, /applicable-themes/);
});
