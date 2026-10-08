import { MOMO_LANGUAGES } from '@shared/momo-settings'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { authErrorOverrides } from './auth-error-overrides'
import changelogEn from './changelogs/changelog_en'
import changelogZhHans from './changelogs/changelog_zh_Hans'
import changelogZhHant from './changelogs/changelog_zh_Hant'
import en from './locales/en/translation.json'
import ja from './locales/ja/translation.json'
import ko from './locales/ko/translation.json'
import zhHans from './locales/zh-Hans/translation.json'
import zhHant from './locales/zh-Hant/translation.json'
import { momoResources } from './momo-resources'

i18n.use(initReactI18next).init({
  supportedLngs: [...MOMO_LANGUAGES],
  returnNull: false,
  resources: {
    'zh-Hans': { translation: { ...zhHans, ...authErrorOverrides['zh-Hans'], ...momoResources['zh-Hans'] } },
    'zh-Hant': { translation: { ...zhHant, ...authErrorOverrides['zh-Hant'], ...momoResources['zh-Hant'] } },
    en: { translation: { ...en, ...authErrorOverrides.en, ...momoResources.en } },
    ja: { translation: { ...ja, ...momoResources.ja } },
    ko: { translation: { ...ko, ...momoResources.ko } },
  },
  fallbackLng: 'en',

  interpolation: {
    escapeValue: false,
  },

  detection: {
    caches: [],
  },
})

export default i18n

export function changelog() {
  switch (i18n.language) {
    case 'zh-Hans':
      return changelogZhHans
    case 'zh-Hant':
      return changelogZhHant
    case 'en':
      return changelogEn
    default:
      return changelogEn
  }
}
