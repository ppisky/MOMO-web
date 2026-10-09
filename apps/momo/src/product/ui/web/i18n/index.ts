import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhHans from './zh-Hans.json';
import zhHant from './zh-Hant.json';
import en from './en.json';
import ja from './ja.json';
import ko from './ko.json';
import { momoResources } from './momo-resources';
import { authErrorOverrides } from './auth-error-overrides';
void i18n.use(initReactI18next).init({
  lng: 'zh-Hans',
  fallbackLng: 'en',
  returnNull: false,
  resources: {
    'zh-Hans': { translation: { ...zhHans, ...authErrorOverrides['zh-Hans'], ...momoResources['zh-Hans'] } },
    'zh-Hant': { translation: { ...zhHant, ...authErrorOverrides['zh-Hant'], ...momoResources['zh-Hant'] } },
    en: { translation: { ...en, ...authErrorOverrides.en, ...momoResources.en } },
    ja: { translation: { ...ja, ...momoResources.ja } },
    ko: { translation: { ...ko, ...momoResources.ko } },
  },
  interpolation: { escapeValue: false },
});
export default i18n;
