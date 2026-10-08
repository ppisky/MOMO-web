import { describe, expect, it, vi } from 'vitest'
import { assertMomoRequestUrl, isChatboxServiceUrl, isMomoProvider } from './momo-policy'
import { createAfetch } from './request/request'

describe('MOMO service boundary', () => {
  it.each(['chatbox-ai', 'qwen-portal', 'github-copilot', undefined])('excludes login provider %s', (id) => {
    expect(isMomoProvider(id)).toBe(false)
  })
  it.each(['openai', 'ollama', 'custom-provider'])('keeps independent provider %s', (id) => {
    expect(isMomoProvider(id)).toBe(true)
  })
  it.each([
    'https://api.chatboxai.app/a',
    'https://CHATBOXAI.APP./a',
    'https://ai-chatbox.com:443/a',
    'https://x.chatboxapp.xyz/a',
  ])('blocks upstream service %s', (url) => {
    expect(isChatboxServiceUrl(url)).toBe(true)
    expect(() => assertMomoRequestUrl(url)).toThrow('MOMO')
  })
  it.each([
    'http://127.0.0.1:11434',
    'https://api.openai.com/v1',
    'https://chatboxai.app.example.com',
    'https://example.com/chatboxai.app',
  ])('does not block unrelated host %s', (url) => {
    expect(isChatboxServiceUrl(url)).toBe(false)
  })
  it('rejects legacy requests before fetch, including Request and URL inputs', async () => {
    const fetch = vi.fn()
    const request = createAfetch({ type: 'desktop', platform: 'win32', os: 'windows', version: '0.1.0' }, fetch)
    for (const input of [
      'https://api.chatboxai.app/a',
      new URL('https://api.chatboxai.app/a'),
      new Request('https://api.chatboxai.app/a'),
    ]) {
      await expect(request(input, {}, { retry: 3 })).rejects.toThrow('MOMO')
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('allows a local model request through the same boundary', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    const request = createAfetch({ type: 'desktop', platform: 'win32', os: 'windows', version: '0.1.0' }, fetch)
    await request('http://127.0.0.1:11434/v1/chat/completions')
    expect(fetch).toHaveBeenCalledOnce()
  })
})
