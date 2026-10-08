import { createDefaultSettings } from '@chatbox/core/domain/settings'
import { describe, expect, it } from 'vitest'
import { getNewMomoSessionSettings, normalizeMomoLanguage } from './momo-settings'
import { ModelProviderType } from './types'

const settings = () => ({
  ...createDefaultSettings(),
  customProviders: [{ id: 'custom-test', name: 'Local', type: ModelProviderType.OpenAI, isCustom: true as const }],
  providers: { 'custom-test': { apiHost: 'http://localhost:9999', models: [{ modelId: 'story' }] } },
})

describe('new roleplay request settings', () => {
  it('keeps zero-valued sampling, output length and disabled streaming', () => {
    const result = getNewMomoSessionSettings({ ...settings(), temperature: 0, topP: 0, maxTokens: 256, stream: false })
    expect(result).toMatchObject({ temperature: 0, topP: 0, maxTokens: 256, stream: false })
    expect(result.provider).toBeUndefined()
  })
  it('ignores a retired default conversation model', () => {
    const result = getNewMomoSessionSettings({
      ...settings(),
      defaultChatModel: { provider: 'openai', model: 'gpt-old' },
    })
    expect(result.provider).toBeUndefined()
    expect(result.modelId).toBeUndefined()
  })
  it('reuses a manually selected, configured custom model', () => {
    expect(getNewMomoSessionSettings(settings(), { provider: 'custom-test', modelId: 'story' })).toMatchObject({
      provider: 'custom-test',
      modelId: 'story',
    })
  })
  it.each([
    { provider: 'ollama', modelId: 'story' },
    { provider: 'custom-test', modelId: 'removed-model' },
    { provider: 'removed-provider', modelId: 'story' },
  ])('does not carry unavailable selections into a new conversation: %j', (last) => {
    expect(getNewMomoSessionSettings(settings(), last).provider).toBeUndefined()
  })
  it('does not reuse a custom provider without a manually configured endpoint', () => {
    const config = settings()
    config.providers['custom-test'].apiHost = ''
    expect(getNewMomoSessionSettings(config, { provider: 'custom-test', modelId: 'story' }).provider).toBeUndefined()
  })
})

it.each(['ru', 'ar', 'de', 'es', 'fr', 'pt-PT', 'sv', 'nb-NO', 'tr', 'it-IT', null])(
  'normalizes retired language %s to English',
  (locale) => {
    expect(normalizeMomoLanguage(locale)).toBe('en')
  }
)
