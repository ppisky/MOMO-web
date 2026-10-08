import { describe, expect, test } from 'vitest'
import { CurrentPlatformCapabilities } from './CurrentPlatformCapabilities'

describe('CurrentPlatformCapabilities', () => {
  test('does not expose work tools on desktop hosts', () => {
    const capabilities = new CurrentPlatformCapabilities({ isDesktopLike: true })

    expect(capabilities.supports('agent-mode')).toBe(false)
  })

  test('disables the Agent Mode capability for non-desktop hosts', () => {
    const capabilities = new CurrentPlatformCapabilities({ isDesktopLike: false })

    expect(capabilities.supports('agent-mode')).toBe(false)
  })
})
