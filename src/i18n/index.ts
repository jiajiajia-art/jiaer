import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh.json';
import enTranslation from './locales/en.json';
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
};

const initialLanguage: AppLanguageCode =
  normalizeAppLanguage(readStoredAppLanguage())
  ?? normalizeAppLanguage(LANGUAGE)
  ?? DEFAULT_APP_LANGUAGE;

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: {
    'zh-TW': ['zh'],
    default: [DEFAULT_APP_LANGUAGE],
  },
  supportedLngs: ['zh', 'zh-TW', 'en'],
  nonExplicitSupportedLngs: false,
  debug: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
