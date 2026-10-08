import type { Language } from '../../shared/types'

// 将 electron getLocale、浏览器的 navigator.language 返回的语言信息，转换为应用的 locale
export function parseLocale(locale: string): Language {
  if (
    locale === 'zh' ||
    locale.startsWith('zh_CN') ||
    locale.startsWith('zh-CN') ||
    locale.startsWith('zh_Hans') ||
    locale.startsWith('zh-Hans')
  ) {
    return 'zh-Hans'
  }
  if (
    locale.startsWith('zh_HK') ||
    locale.startsWith('zh-HK') ||
    locale.startsWith('zh_TW') ||
    locale.startsWith('zh-TW') ||
    locale.startsWith('zh_Hant') ||
    locale.startsWith('zh-Hant')
  ) {
    return 'zh-Hant'
  }
  if (locale.startsWith('ja')) {
    return 'ja'
  }
  if (locale.startsWith('ko')) {
    return 'ko'
  }
  return 'en'
}
