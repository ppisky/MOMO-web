import { expect, it } from 'vitest'
import { normalizeCustomApiEndpoint } from './custom-api-endpoint'

it('uses a standard protocol path on a manually entered local root URL', () => {
  expect(normalizeCustomApiEndpoint({ apiHost: 'http://localhost:11435' })).toEqual({
    apiHost: 'http://localhost:11435/v1',
    apiPath: '/chat/completions',
  })
})
it('respects a complete endpoint and an explicit nonstandard path', () => {
  expect(normalizeCustomApiEndpoint({ apiHost: 'https://example.com/relay/chat/completions' })).toEqual({
    apiHost: 'https://example.com/relay',
    apiPath: '/chat/completions',
  })
  expect(normalizeCustomApiEndpoint({ apiHost: 'https://api.openai.com/custom', apiPath: 'my/reply' })).toEqual({
    apiHost: 'https://api.openai.com/custom',
    apiPath: '/my/reply',
  })
})
it('does not add provider-specific paths or fall back to a vendor URL', () => {
  expect(normalizeCustomApiEndpoint({ apiHost: 'https://openrouter.ai' })).toEqual({
    apiHost: 'https://openrouter.ai/v1',
    apiPath: '/chat/completions',
  })
  expect(() => normalizeCustomApiEndpoint({ apiHost: '' })).toThrow()
})
