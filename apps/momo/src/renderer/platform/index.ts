import { trackBlobWrite } from '../storage/blob-write-tracker'
import type { Platform } from './interfaces'
import TestPlatform from './test_platform'
import WebPlatform from './web_platform'

function initPlatform(): Platform {
  const platform = createPlatform()
  // Track every blob write at the platform boundary (parsers and remote code call
  // platform.setStoreBlob() directly, bypassing storage.setBlob()), so the
  // orphaned-blob cleanup can protect in-flight blobs whose durable references
  // are not persisted yet. See storage/blob-write-tracker.ts.
  const originalSetStoreBlob = platform.setStoreBlob.bind(platform)
  platform.setStoreBlob = (key: string, value: string) => {
    trackBlobWrite(key)
    return originalSetStoreBlob(key, value)
  }
  return platform
}

function createPlatform(): Platform {
  // 测试环境使用 TestPlatform
  if (process.env.NODE_ENV === 'test') {
    return new TestPlatform()
  }
  return new WebPlatform()
}

export default initPlatform()
