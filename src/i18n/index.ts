import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh.json';
import enTranslation from './locales/en.json';
import { LANGUAGE } from '../config';

const resources = {
  zh: {
    translation: zhTranslation,
  },
  en: {
    translation: enTranslation,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: LANGUAGE,
  fallbackLng: 'zh',
  supportedLngs: ['zh', 'en'],
  debug: false,

  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
