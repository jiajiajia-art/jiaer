/**
 * 全站语言切换：简体 / 繁体 / 英文 / 日语，默认简体
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APP_LANGUAGE_OPTIONS,
  APP_LANGUAGE_STORAGE_KEY,
  APP_LANGUAGE_USER_CHOICE_KEY,
  DEFAULT_APP_LANGUAGE,
  applyAppLanguage,
  getNavbarLanguageTriggerLabel,
  hasUserLanguageChoice,
  mapTranslationTree,
  normalizeAppLanguage,
  persistAppLanguage,
  readStoredAppLanguage,
} from '../src/utils/appLanguage.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('normalizeAppLanguage_应归一简体英文繁体日语', () => {
  assert.equal(normalizeAppLanguage('zh'), 'zh');
  assert.equal(normalizeAppLanguage('zh-CN'), 'zh');
  assert.equal(normalizeAppLanguage('zh-Hans'), 'zh');
  assert.equal(normalizeAppLanguage('en'), 'en');
  assert.equal(normalizeAppLanguage('en-US'), 'en');
  assert.equal(normalizeAppLanguage('zh-TW'), 'zh-TW');
  assert.equal(normalizeAppLanguage('zh-HK'), 'zh-TW');
  assert.equal(normalizeAppLanguage('zh-Hant'), 'zh-TW');
  assert.equal(normalizeAppLanguage('ja'), 'ja');
  assert.equal(normalizeAppLanguage('ja-JP'), 'ja');
  assert.equal(normalizeAppLanguage('jp'), 'ja');
  assert.equal(normalizeAppLanguage('fr'), null);
  assert.equal(DEFAULT_APP_LANGUAGE, 'zh');
});

test('APP_LANGUAGE_OPTIONS_应含四档且为平台化英文名', () => {
  assert.deepEqual(
    APP_LANGUAGE_OPTIONS.map((item) => item.code),
    ['zh', 'zh-TW', 'en', 'ja'],
  );
  assert.equal(APP_LANGUAGE_OPTIONS[0].label, 'Chinese (Simplified)');
  assert.equal(APP_LANGUAGE_OPTIONS[1].label, 'Chinese (Traditional)');
  assert.equal(APP_LANGUAGE_OPTIONS[2].label, 'English');
  assert.equal(APP_LANGUAGE_OPTIONS[3].label, 'Japanese');
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
  assert.equal(hasUserLanguageChoice(), false);
  const chosen = await applyAppLanguage('ja', async (lng) => {
    calls.push(lng);
  }, { userChoice: true });
  assert.equal(chosen, 'ja');
  assert.equal(mem.get(APP_LANGUAGE_USER_CHOICE_KEY), '1');
  assert.equal(hasUserLanguageChoice(), true);
  delete globalThis.window;
});

test('mapTranslationTree_应转换字符串叶子', () => {
  const tree = mapTranslationTree(
    { nav: { profile: '个人中心' }, list: ['仓库'] },
    (text) => text.replace('个人中心', '個人中心').replace('仓库', '倉庫'),
  );
  assert.deepEqual(tree, { nav: { profile: '個人中心' }, list: ['倉庫'] });
});

test('i18n_应注册 zh zh-TW en ja 且默认简体', () => {
  const src = read('src/i18n/index.ts');
  assert.match(src, /'zh-TW'/);
  assert.match(src, /locales\/ja\.json/);
  assert.match(src, /supportedLngs:\s*\['zh',\s*'zh-TW',\s*'en',\s*'ja'\]/);
  assert.match(src, /DEFAULT_APP_LANGUAGE|readStoredAppLanguage/);
  assert.match(src, /convertSimplifiedToTraditional/);
  assert.match(read('src/config.ts'), /LANGUAGE:\s*'zh'\s*\|\s*'zh-TW'\s*\|\s*'en'\s*\|\s*'ja'\s*=\s*'zh'/);
});

test('Navbar_语言入口应在顶栏最右且未登录也可用', () => {
  const tsx = read('src/components/Layout/Navbar.tsx');
  const css = read('src/components/Layout/Navbar.module.css');
  const modalTsx = read('src/components/Layout/LanguageSelectModal.tsx');
  const modalCss = read('src/components/Layout/LanguageSelectModal.module.css');
  assert.match(tsx, /LanguageSelectModal/);
  assert.match(tsx, /showLanguageModal/);
  assert.match(tsx, /getNavbarLanguageTriggerLabel\(activeLanguage\)/);
  assert.match(tsx, /userChoice:\s*true/);
  assert.match(tsx, /t\('nav\.logoHome'\)/);
  assert.match(read('src/store/useGeoRegionStore.ts'), /hasUserLanguageChoice\(\)/);
  assert.match(tsx, /className=\{styles\.langTrigger\}/);
  // 功能注释：语言不再藏在个人菜单；入口在登录/头像之后，访客也可开弹窗
  assert.doesNotMatch(tsx, /nav\.profile[\s\S]*setShowLanguageModal\(true\)[\s\S]*nav\.language/);
  assert.doesNotMatch(tsx, /\{t\('nav\.language'\)\}/);
  assert.match(css, /\.langTrigger\s*\{/);
  assert.match(modalTsx, /APP_LANGUAGE_OPTIONS/);
  assert.match(modalTsx, />\s*Language\s*</);
  assert.match(modalTsx, /nativeLabel/);
  assert.match(modalCss, /\.sheet\s*\{[\s\S]*?(?:#1A1A1A|var\(--|color-mix\()/);
  assert.match(modalCss, /--lang-accent:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.match(modalCss, /\.optionActive\s*\{[\s\S]*?var\(--lang-accent\)/);
  assert.match(read('src/i18n/locales/zh.json'), /"chooseLanguage":\s*"选择语言"/);
  assert.match(read('src/i18n/locales/en.json'), /"chooseLanguage":\s*"Choose language"/);
  assert.match(read('src/i18n/locales/ja.json'), /"chooseLanguage":\s*"言語を選択"/);
});

test('getNavbarLanguageTriggerLabel_应为英文简称', () => {
  assert.equal(getNavbarLanguageTriggerLabel('zh'), 'ZH');
  assert.equal(getNavbarLanguageTriggerLabel('zh-TW'), 'ZH-TW');
  assert.equal(getNavbarLanguageTriggerLabel('en'), 'EN');
  assert.equal(getNavbarLanguageTriggerLabel('ja'), 'JA');
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
