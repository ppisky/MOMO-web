import { MOMO_LANGUAGES } from '@shared/momo-settings'
import { describe, expect, it } from 'vitest'
import { languages } from './locales'
import { momoResources } from './momo-resources'
import { parseLocale } from './parser'

describe('MOMO interface translations', () => {
  it('offers exactly Simplified Chinese, Traditional Chinese, Japanese, Korean and English', () => {
    expect(languages).toEqual(['zh-Hans', 'zh-Hant', 'ja', 'ko', 'en'])
    expect(Object.keys(momoResources).sort()).toEqual([...languages].sort())
  })
  for (const locale of MOMO_LANGUAGES) {
    it(`has nonempty translations and preserves interpolation in ${locale}`, () => {
      const keys = Object.keys(momoResources.en)
      expect(Object.keys(momoResources[locale]).sort()).toEqual(keys.sort())
      for (const key of keys) {
        const value = momoResources[locale][key as keyof typeof momoResources.en]
        expect(value.trim(), key).not.toBe('')
        expect(value.match(/\{\{[^}]+\}\}/g) || [], key).toEqual(key.match(/\{\{[^}]+\}\}/g) || [])
      }
    })
  }
  it.each([
    ['zh-CN', 'zh-Hans'],
    ['zh-TW', 'zh-Hant'],
    ['zh-HK', 'zh-Hant'],
    ['ja-JP', 'ja'],
    ['ko-KR', 'ko'],
    ['de-DE', 'en'],
    ['ar-EG', 'en'],
  ])('maps OS locale %s to %s', (input, output) => {
    expect(parseLocale(input)).toBe(output)
  })
})
