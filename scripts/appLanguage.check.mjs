/**
 * 全站语言切换：简体 / 英文 / 繁体，默认简体
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APP_LANGUAGE_OPTIONS,
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_APP_LANGUAGE,
  applyAppLanguage,
  mapTranslationTree,
  normalizeAppLanguage,
  persistAppLanguage,
  readStoredAppLanguage,
} from '../src/utils/appLanguage.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('normalizeAppLanguage_应归一简体英文繁体', () => {
  assert.equal(normalizeAppLanguage('zh'), 'zh');
  assert.equal(normalizeAppLanguage('zh-CN'), 'zh');
  assert.equal(normalizeAppLanguage('zh-Hans'), 'zh');
  assert.equal(normalizeAppLanguage('en'), 'en');
  assert.equal(normalizeAppLanguage('en-US'), 'en');
  assert.equal(normalizeAppLanguage('zh-TW'), 'zh-TW');
  assert.equal(normalizeAppLanguage('zh-HK'), 'zh-TW');
  assert.equal(normalizeAppLanguage('zh-Hant'), 'zh-TW');
  assert.equal(normalizeAppLanguage('fr'), null);
  assert.equal(DEFAULT_APP_LANGUAGE, 'zh');
});

test('APP_LANGUAGE_OPTIONS_应含三档且标签为母语名', () => {
  assert.deepEqual(
    APP_LANGUAGE_OPTIONS.map((item) => item.code),
    ['zh', 'en', 'zh-TW'],
  );
  assert.equal(APP_LANGUAGE_OPTIONS[0].label, '简体中文');
  assert.equal(APP_LANGUAGE_OPTIONS[1].label, 'English');
  assert.equal(APP_LANGUAGE_OPTIONS[2].label, '繁體中文');
});

test('persistAppLanguage_读写本地存储默认简体', () => {
  const mem = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (mem.has(key) ? mem.get(key) : null),
      setItem: (key, value) => {
        mem.set(key, String(value));
      },
    },
  };
  assert.equal(readStoredAppLanguage(), 'zh');
  persistAppLanguage('en');
  assert.equal(mem.get(APP_LANGUAGE_STORAGE_KEY), 'en');
  assert.equal(readStoredAppLanguage(), 'en');
  persistAppLanguage('zh-TW');
  assert.equal(readStoredAppLanguage(), 'zh-TW');
  delete globalThis.window;
});

test('applyAppLanguage_应持久化并调用 changeLanguage', async () => {
  const mem = new Map();
  const calls = [];
  globalThis.window = {
    localStorage: {
      getItem: (key) => (mem.has(key) ? mem.get(key) : null),
      setItem: (key, value) => {
        mem.set(key, String(value));
      },
    },
  };
  const next = await applyAppLanguage('zh-TW', async (lng) => {
    calls.push(lng);
  });
  assert.equal(next, 'zh-TW');
  assert.deepEqual(calls, ['zh-TW']);
  assert.equal(mem.get(APP_LANGUAGE_STORAGE_KEY), 'zh-TW');
  delete globalThis.window;
});

test('mapTranslationTree_应转换字符串叶子', () => {
  const tree = mapTranslationTree(
    { nav: { profile: '个人中心' }, list: ['仓库'] },
    (text) => text.replace('个人中心', '個人中心').replace('仓库', '倉庫'),
  );
  assert.deepEqual(tree, { nav: { profile: '個人中心' }, list: ['倉庫'] });
});

test('i18n_应注册 zh zh-TW en 且默认简体', () => {
  const src = read('src/i18n/index.ts');
  assert.match(src, /'zh-TW'/);
  assert.match(src, /supportedLngs:\s*\['zh',\s*'zh-TW',\s*'en'\]/);
  assert.match(src, /DEFAULT_APP_LANGUAGE|readStoredAppLanguage/);
  assert.match(src, /convertSimplifiedToTraditional/);
  assert.match(read('src/config.ts'), /LANGUAGE:\s*'zh'\s*\|\s*'zh-TW'\s*\|\s*'en'\s*=\s*'zh'/);
});

test('Navbar_用户菜单应打开语言弹窗而非内嵌三档列表', () => {
  const tsx = read('src/components/Layout/Navbar.tsx');
  const css = read('src/components/Layout/Navbar.module.css');
  const modalTsx = read('src/components/Layout/LanguageSelectModal.tsx');
  const modalCss = read('src/components/Layout/LanguageSelectModal.module.css');
  assert.match(tsx, /LanguageSelectModal/);
  assert.match(tsx, /showLanguageModal/);
  assert.match(tsx, /nav\.profile[\s\S]*setShowLanguageModal\(true\)[\s\S]*nav\.language/);
  assert.doesNotMatch(tsx, /langSwitcher|langMenuValue|getAppLanguageLabel/);
  assert.doesNotMatch(css, /\.langSwitcher|\.langMenuValue/);
  assert.match(modalTsx, /APP_LANGUAGE_OPTIONS/);
  assert.match(modalTsx, /nav\.chooseLanguage/);
  assert.match(modalCss, /\.sheet\s*\{[\s\S]*?#1A1A1A/);
  assert.match(modalCss, /--lang-accent:\s*#8E2135/);
  assert.match(modalCss, /\.optionActive\s*\{[\s\S]*?var\(--lang-accent\)/);
  assert.match(read('src/i18n/locales/zh.json'), /"chooseLanguage":\s*"选择语言"/);
  assert.match(read('src/i18n/locales/en.json'), /"chooseLanguage":\s*"Choose language"/);
});

test('localizeChineseByLanguage_繁体才转写接口中文', async () => {
  const { localizeChineseByLanguage } = await import('../src/utils/chineseScript.ts');
  assert.equal(localizeChineseByLanguage('休闲益智', 'zh'), '休闲益智');
  assert.equal(localizeChineseByLanguage('休闲益智', 'en'), '休闲益智');
  assert.equal(localizeChineseByLanguage('休闲益智', 'zh-TW'), '休閒益智');
  assert.equal(localizeChineseByLanguage('现代都市', 'zh-TW'), '現代都市');
  const themeTags = read('src/utils/themeTags.ts');
  assert.match(themeTags, /localizeChineseByLanguage\(tag\.name/);
  assert.match(themeTags, /localizeChineseByLanguage\(tag\.pathLabel/);
  assert.match(themeTags, /useLocalizedThemeTags/);
});

test('CustomIFCreate_题材芯片应走本地化展示', () => {
  const tsx = read('src/page/CustomIFCreate.tsx');
  assert.match(tsx, /useLocalizedThemeTags/);
  assert.match(tsx, /displayThemeTags\.map/);
});
