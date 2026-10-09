import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platform: { type: 'web', getVersion: vi.fn(async () => '1.0.0') },
  mobileRequest: vi.fn(),
}))

vi.mock('@/platform', () => ({ default: mocks.platform }))
vi.mock('./mobile-request', () => ({ handleMobileRequest: mocks.mobileRequest }))

import { apiRequest } from './request'

describe('provider API request routing', () => {
  afterEach(() => {
    mocks.platform.type = 'web'
    mocks.platform.getVersion.mockClear()
    mocks.mobileRequest.mockReset()
    vi.unstubAllGlobals()
  })

  it('sends credentials and payload only to the configured provider using browser fetch', async () => {
    const response = new Response('ok')
    const rendererFetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', rendererFetch)
    const controller = new AbortController()
    await expect(
      apiRequest.post('https://provider.example/v1/chat', { authorization: 'Bearer test-only' }, '{"stream":true}', {
        signal: controller.signal,
        useProxy: true,
        retry: 0,
      })
    ).resolves.toBe(response)
    expect(rendererFetch).toHaveBeenCalledWith(
      'https://provider.example/v1/chat',
      expect.objectContaining({
        method: 'POST',
        body: '{"stream":true}',
        signal: controller.signal,
      })
    )
    const headers = rendererFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-only')
    expect(headers.get('CHATBOX-TARGET-URI')).toBeNull()
  })

  it('calls local providers directly from the browser', async () => {
    const response = new Response('ok')
    const rendererFetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', rendererFetch)

    await expect(apiRequest.get('http://127.0.0.1:11434/api/tags', {}, { useProxy: true, retry: 0 })).resolves.toBe(
      response
    )

    expect(rendererFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('preserves upstream errors without retrying', async () => {
    const rendererFetch = vi.fn().mockResolvedValue(new Response('upstream unavailable', { status: 503 }))
    vi.stubGlobal('fetch', rendererFetch)

    const request = apiRequest.get('https://provider.example/v1/models', {}, { useProxy: true, retry: 3 })

    await expect(request).rejects.toMatchObject({
      message: 'API Error: Status Code 503',
      responseBody: 'upstream unavailable',
    })
    expect(rendererFetch).toHaveBeenCalledTimes(1)
  })

  it('preserves cancellation without retrying', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    const rendererFetch = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', rendererFetch)

    const request = apiRequest.get('https://provider.example/v1/models', {}, { useProxy: true, retry: 3 })

    await expect(request).rejects.toBe(abortError)
    expect(rendererFetch).toHaveBeenCalledTimes(1)
  })

  it('never relays web API credentials through Chatbox even with a legacy proxy setting', async () => {
    mocks.platform.type = 'web'
    const response = new Response('ok')
    const rendererFetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', rendererFetch)

    await apiRequest.get('https://provider.example/v1/models', {}, { useProxy: true, retry: 0 })

    expect(rendererFetch).toHaveBeenCalledWith(
      'https://provider.example/v1/models',
      expect.objectContaining({ method: 'GET' })
    )
    const headers = rendererFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('CHATBOX-TARGET-URI')).toBeNull()
    expect(mocks.platform.getVersion).not.toHaveBeenCalled()
  })
  it('rejects a direct Chatbox target before any transport is called', async () => {
    const rendererFetch = vi.fn()
    vi.stubGlobal('fetch', rendererFetch)
    await expect(apiRequest.get('https://api.chatboxai.app/models', {}, { useProxy: true })).rejects.toThrow('MOMO')
    expect(rendererFetch).not.toHaveBeenCalled()
    expect(mocks.mobileRequest).not.toHaveBeenCalled()
  })
})
