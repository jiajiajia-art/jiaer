import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh.json';
import enTranslation from './locales/en.json';
import jaTranslation from './locales/ja.json';
import { LANGUAGE } from '../config';
import {
  DEFAULT_APP_LANGUAGE,
  mapTranslationTree,
  normalizeAppLanguage,
  readStoredAppLanguage,
  type AppLanguageCode,
} from '../utils/appLanguage';
import { convertSimplifiedToTraditional } from '../utils/chineseScript';

/** 功能注释：简体 JSON 运行时转繁体，避免维护第二份巨型文案 */
const zhTWTranslation = mapTranslationTree(zhTranslation, convertSimplifiedToTraditional) as typeof zhTranslation;

const resources = {
  zh: {
    translation: zhTranslation,
  },
  'zh-TW': {
    translation: zhTWTranslation,
  },
  en: {
    translation: enTranslation,
  },
  ja: {
    translation: jaTranslation,
  },
};

const initialLanguage: AppLanguageCode =
  normalizeAppLanguage(readStoredAppLanguage())
  ?? normalizeAppLanguage(LANGUAGE)
  ?? DEFAULT_APP_LANGUAGE;

function syncDocumentLanguage(code: string) {
  if (typeof document === 'undefined') return;
  const normalized = normalizeAppLanguage(code);
  document.documentElement.lang = normalized === 'zh-TW' ? 'zh-Hant' : (normalized || 'zh');
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: {
    'zh-TW': ['zh'],
    ja: ['en', 'zh'],
    default: [DEFAULT_APP_LANGUAGE],
  },
  supportedLngs: ['zh', 'zh-TW', 'en', 'ja'],
  nonExplicitSupportedLngs: false,
  debug: false,
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(initialLanguage);

export default i18n;
