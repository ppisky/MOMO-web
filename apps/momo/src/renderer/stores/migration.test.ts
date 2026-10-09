// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import platform from '@/platform'
import { initData } from '@/setup/init_data'
import storage, { StorageKey } from '@/storage'
import { _migrateStorageForTest, CurrentVersion } from './migration'

vi.mock('@/setup/init_data', () => ({ initData: vi.fn(async () => {}) }))
vi.mock('@/setup/momo-migration', () => ({ migrateToMomoRoleplay: vi.fn() }))

describe('browser storage initialization', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    platform.type = 'web'
    for (const key of await platform.getAllStoreKeys()) await platform.delStoreValue(key)
    localStorage.clear()
  })

  it('initializes only once and records the current schema version', async () => {
    await _migrateStorageForTest()
    await _migrateStorageForTest()
    expect(await storage.getItem(StorageKey.ConfigVersion, 0)).toBe(CurrentVersion)
    expect(initData).toHaveBeenCalledTimes(1)
  })

  it('keeps existing sessions and settings when the browser schema is current', async () => {
    await storage.setItemNow(StorageKey.ConfigVersion, CurrentVersion)
    const session = { id: 'browser-session', messages: [{ role: 'user', content: 'keep me' }] }
    const settings = { language: 'zh-Hans', customProviders: [] }
    await storage.setItemNow('session:browser-session', session)
    await storage.setItemNow(StorageKey.Settings, settings)
    await _migrateStorageForTest()
    expect(await storage.getItem('session:browser-session', null)).toEqual(session)
    expect(await storage.getItem(StorageKey.Settings, null)).toEqual(settings)
    expect(initData).not.toHaveBeenCalled()
  })

  it('leaves existing older browser data for the data migration stage', async () => {
    await storage.setItemNow(StorageKey.ConfigVersion, CurrentVersion - 1)
    await storage.setItemNow('session:existing', { id: 'existing' })
    await _migrateStorageForTest()
    expect(await storage.getItem(StorageKey.ConfigVersion, 0)).toBe(CurrentVersion - 1)
    expect(await storage.getItem('session:existing', null)).toEqual({ id: 'existing' })
    expect(initData).not.toHaveBeenCalled()
  })
})
