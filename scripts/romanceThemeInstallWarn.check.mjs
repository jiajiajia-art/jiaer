/**
 * C0.2 安装玩法 / 手机应用时的题材不一致提示：只警告不阻断
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');
const load = (p) => import(pathToFileURL(join(romance, p)).href);

const TAGS = [
  { id: 1, name: '现代都市', code: 'modern' },
  { id: 2, name: '古代仙侠', code: 'ancient' },
  { id: 3, name: '通用', code: 'universal' },
];

test('isThemeMismatch_id精确比对_列表为空或世界未知不误报', async () => {
  const { isThemeMismatch } = await load('lib/officialThemeApplicability.ts');
  assert.equal(isThemeMismatch({ worldThemeTagId: 2, applicableThemeTagIds: [1] }), true);
  assert.equal(isThemeMismatch({ worldThemeTagId: 1, applicableThemeTagIds: [1, 3] }), false);
  assert.equal(isThemeMismatch({ worldThemeTagId: 2, applicableThemeTagIds: [] }), false);
  assert.equal(isThemeMismatch({ worldThemeTagId: null, applicableThemeTagIds: [1] }), false);
  assert.equal(isThemeMismatch({}), false);
});

test('isThemeMismatch_无id时走语义桶_universal不冲突_世界题材归不进桶不冲突', async () => {
  const { isThemeMismatch } = await load('lib/officialThemeApplicability.ts');
  assert.equal(isThemeMismatch({ worldThemeLabel: '古代仙侠', applicableThemeCodes: ['modern'] }), true);
  assert.equal(isThemeMismatch({ worldThemeCode: 'modern', applicableThemeCodes: ['ancient'] }), true);
  assert.equal(isThemeMismatch({ worldThemeLabel: '现代都市', applicableThemeCodes: ['modern'] }), false);
  assert.equal(isThemeMismatch({ worldThemeLabel: '古代', applicableThemeCodes: ['universal'] }), false);
  assert.equal(isThemeMismatch({ worldThemeLabel: '古代', applicableThemeCodes: ['modern', 'ancient'] }), false);
  assert.equal(isThemeMismatch({ worldThemeLabel: '末日废土', applicableThemeCodes: ['modern'] }), false);
  assert.equal(isThemeMismatch({ worldThemeLabel: '古代', applicableThemeCodes: [] }), false);
});

test('isItemThemeMismatch_用启用题材表把官方code解析成id再比对_条目自带id优先', async () => {
  const { isItemThemeMismatch } = await load('lib/officialThemeApplicability.ts');
  const modernPack = { applicableThemeCodes: ['modern'] };
  assert.equal(isItemThemeMismatch(modernPack, { worldThemeTagId: 2, enabledThemeTags: TAGS }), true);
  assert.equal(isItemThemeMismatch(modernPack, { worldThemeTagId: 1, enabledThemeTags: TAGS }), false);
  // universal 解析成全部启用题材：任何世界都不冲突
  assert.equal(isItemThemeMismatch({ applicableThemeCodes: ['universal'] }, { worldThemeTagId: 2, enabledThemeTags: TAGS }), false);
  // 条目自带已解析 id 优先于 code
  assert.equal(isItemThemeMismatch({ applicableThemeCodes: ['modern'], applicableThemeTagIds: [2] }, { worldThemeTagId: 2, enabledThemeTags: TAGS }), false);
  // 没有题材表也没有 id：仍可凭世界题材名走语义桶
  assert.equal(isItemThemeMismatch(modernPack, { worldThemeLabel: '仙侠' }), true);
  // 世界题材未知：不提示
  assert.equal(isItemThemeMismatch(modernPack, {}), false);
});

test('官方玩法与应用种子_现代包在古代世界会提示_通用包不提示', async () => {
  const { isItemThemeMismatch, OFFICIAL_PLAY_MOD_THEME_CODES, OFFICIAL_PLATFORM_APP_THEME_CODES } = await load('lib/officialThemeApplicability.ts');
  const ancient = { worldThemeTagId: 2, enabledThemeTags: TAGS };
  assert.equal(isItemThemeMismatch({ applicableThemeCodes: OFFICIAL_PLAY_MOD_THEME_CODES['pack-cars'] }, ancient), true);
  assert.equal(isItemThemeMismatch({ applicableThemeCodes: OFFICIAL_PLAY_MOD_THEME_CODES['pack-relations'] }, ancient), false);
  assert.equal(isItemThemeMismatch({ applicableThemeCodes: OFFICIAL_PLATFORM_APP_THEME_CODES.weibo }, ancient), true);
  assert.equal(isItemThemeMismatch({ applicableThemeCodes: OFFICIAL_PLATFORM_APP_THEME_CODES.mail }, ancient), false);
});

test('警告文案固定', async () => {
  const { THEME_MISMATCH_INSTALL_WARN } = await load('lib/officialThemeApplicability.ts');
  assert.equal(THEME_MISMATCH_INSTALL_WARN, '当前世界题材与该玩法标注的适用题材不一致，仍可安装');
});

test('AddPlayModModal_安装前toast警告一次_不阻断安装_无原生弹窗', () => {
  const src = read('components/AddPlayModModal.tsx');
  assert.match(src, /worldThemeTagId\?: number \| null/);
  assert.match(src, /isItemThemeMismatch\(row, worldTheme\)/);
  assert.match(src, /themeWarnedRef/);
  assert.match(src, /toast\(THEME_MISMATCH_INSTALL_WARN/);
  // 警告在 onChange(next) 之前，且之后没有 return 阻断
  const warnAt = src.indexOf('toast(THEME_MISMATCH_INSTALL_WARN');
  const installAt = src.indexOf('onChange(next)');
  assert.ok(warnAt > 0 && installAt > warnAt);
  const between = src.slice(warnAt, installAt);
  assert.doesNotMatch(between.split('\n').slice(0, 2).join('\n'), /return/);
  assert.doesNotMatch(src, /\b(?:window\.)?(?:alert|confirm)\(/);
});

test('PhoneAppsEditor_装应用前同样提示_按官方应用code兜底', () => {
  const src = read('components/PhoneAppsEditor.tsx');
  assert.match(src, /officialAppThemeCodes\(appId\)/);
  assert.match(src, /toast\(THEME_MISMATCH_INSTALL_WARN/);
  const installFn = src.slice(src.indexOf('const install = (appId: string)'));
  const warnAt = installFn.indexOf('THEME_MISMATCH_INSTALL_WARN');
  const changeAt = installFn.indexOf('onChange(compactInstalledAppIds');
  assert.ok(warnAt > 0 && changeAt > warnAt, '先提示后安装，不拦截');
});

test('ModEditorPanel_从清单读世界题材并传给两个安装入口', () => {
  const src = read('components/ModEditorPanel.tsx');
  assert.match(src, /readWorldThemeHint\(m\)/);
  assert.equal((src.match(/worldThemeTagId=\{worldTheme\.themeTagId\}/g) ?? []).length, 2);
  const types = read('mods/types.ts');
  for (const f of ['themeTagId?:', 'themeLabel?:', 'themeCode?:', 'commsSkin?:']) assert.ok(types.includes(f), f);
});
