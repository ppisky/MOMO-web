import { MOMO_LANGUAGES, type MomoLanguage, normalizeMomoLanguage } from '@shared/momo-settings'
export const languageNameMap: Record<MomoLanguage, string> = {
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  en: 'English',
}
export const languages = [...MOMO_LANGUAGES]

export function getLanguageName(value: unknown): string {
  return languageNameMap[normalizeMomoLanguage(value)]
}
