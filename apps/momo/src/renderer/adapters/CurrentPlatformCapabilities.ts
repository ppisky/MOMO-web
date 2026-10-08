import type { PlatformCapabilitiesPort, PlatformCapability } from '@chatbox/core/ports'

export interface CurrentPlatformCapabilitySource {
  isDesktopLike: boolean
}

/**
 * Captures only the desktop-like Agent Mode gate consumed by GenerationService.
 * Feature-specific gates such as knowledge-base availability remain with their
 * real consumers, where platform details such as Windows ARM64 are available.
 */
export class CurrentPlatformCapabilities implements PlatformCapabilitiesPort {
  // The source argument remains compatible with existing platform adapters.
  constructor(_source?: CurrentPlatformCapabilitySource) {}
  supports(_capability: PlatformCapability): boolean {
    return false
  }
}
