import { createDefaultSettings } from '@chatbox/core/domain/settings'
import { describe, expect, it, vi } from 'vitest'
import { type Config, ModelProviderType } from '../types'
import type { ModelDependencies } from '../types/adapters'
import CustomOpenAI from './definitions/models/custom-openai'
import { getModel, getProviderSettings, getSystemProviders } from './index'

const settings = () => ({
  ...createDefaultSettings(),
  customProviders: [
    {
      id: 'custom-test',
      name: 'Local',
      type: ModelProviderType.OpenAI,
      isCustom: true as const,
      defaultSettings: { apiHost: 'https://unused.example/v1' },
    },
  ],
  providers: { 'custom-test': { apiHost: 'http://localhost:9999/proxy', models: [{ modelId: 'story' }] } },
})
const dependencies: ModelDependencies = {
  request: { apiRequest: vi.fn(), fetchWithOptions: vi.fn() },
  storage: { saveImage: vi.fn(), getImage: vi.fn() },
  sentry: { captureException: vi.fn(), withScope: vi.fn() },
  getRemoteConfig: vi.fn(),
}
const session = { provider: 'custom-test', modelId: 'story', temperature: 0, topP: 0, maxTokens: 256, stream: false }

describe('custom-only models', () => {
  it('does not expose any system provider presets', () => expect(getSystemProviders()).toEqual([]))
  it.each(['openai', 'ollama', 'claude'])('rejects a builtin provider ID %s', (provider) => {
    expect(() => getModel({ provider, modelId: 'story' }, settings(), {} as Config, dependencies)).toThrow()
  })
  it('requires an explicit endpoint without falling back to legacy descriptor defaults', () => {
    const config = settings()
    config.providers['custom-test'].apiHost = ''
    expect(() => getProviderSettings(session, config)).toThrow('enter an API endpoint')
  })
  it.each(['file:///C:/temp/model', 'https://user:pass@example.com', 'https://api.chatboxai.app'])(
    'rejects disallowed endpoint %s',
    (host) => {
      const config = settings()
      config.providers['custom-test'].apiHost = host
      expect(() => getProviderSettings(session, config)).toThrow()
    }
  )
  it('does not silently substitute an unconfigured model', () => {
    expect(() => getModel({ ...session, modelId: 'missing' }, settings(), {} as Config, dependencies)).toThrow(
      'add and select a model ID'
    )
  })
  it('passes request parameters to the custom protocol adapter without rewriting the supplied path', () => {
    const model = getModel(session, settings(), {} as Config, dependencies)
    expect(model).toBeInstanceOf(CustomOpenAI)
    if (model instanceof CustomOpenAI)
      expect(model.options).toMatchObject({
        apiHost: 'http://localhost:9999/proxy',
        apiPath: '/chat/completions',
        temperature: 0,
        topP: 0,
        maxOutputTokens: 256,
        stream: false,
      })
    expect(dependencies.request.apiRequest).not.toHaveBeenCalled()
  })
})
