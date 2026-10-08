// @vitest-environment jsdom
import { webcrypto } from 'node:crypto'
import { settings as defaultSettings } from '@shared/defaults'
import { type Session, SessionSchema, SettingsSchema } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { records, removed, metaDelete, writes } = vi.hoisted(() => ({
  records: new Map<string, unknown>(),
  removed: vi.fn(),
  metaDelete: vi.fn(),
  writes: vi.fn(),
}))
vi.mock('@/storage', () => ({
  StorageKey: { Settings: 'settings', AuthInfo: 'authInfo', RemoteConfig: 'remoteConfig' },
  default: {
    getItem: vi.fn(async (key: string, initial: unknown) => records.get(key) ?? initial),
    setItemNow: writes.mockImplementation(async (key: string, value: unknown) => {
      records.set(key, structuredClone(value))
    }),
    removeItem: removed.mockImplementation(async (key: string) => {
      records.delete(key)
    }),
  },
}))
vi.mock('@/storage/StoreStorage', () => ({ StorageKeyGenerator: { session: (id: string) => `session:${id}` } }))
vi.mock('@/stores/sessionHelpers', () => ({ getMetaStorage: async () => ({ delete: metaDelete }) }))

import { isUnmodifiedExample, migrateToMomoRoleplay, removeRetiredServiceSettings } from './momo-migration'

const example = (): Session =>
  SessionSchema.parse({
    id: 'justchat-b612-406a-985b-3ab4d2c482ff',
    name: 'Just chat',
    type: 'chat',
    messages: [
      {
        id: 'a700be6c-cbdd-43a3-b572-49e7a921c059',
        role: 'system',
        contentParts: [{ type: 'text', text: 'You are a helpful assistant.' }],
      },
    ],
  })
const cleanupKey = 'momo:roleplay-migration:v1'
const backupKey = 'momo:retired-examples-backup:v1'

describe('roleplay migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    records.clear()
    localStorage.clear()
    vi.stubGlobal('crypto', webcrypto)
    metaDelete.mockResolvedValue(undefined)
  })
  it('matches the original template by ID, title and message content', async () => {
    expect(await isUnmodifiedExample(example())).toBe(true)
  })
  it.each(['continued', 'edited', 'renamed', 'forked', 'threaded', 'attachment', 'settings'])(
    'preserves %s examples',
    async (kind) => {
      const session = example()
      if (kind === 'continued')
        session.messages.push({ id: 'user-story', role: 'user', contentParts: [{ type: 'text', text: '我的故事' }] })
      if (kind === 'edited') session.messages[0].contentParts = [{ type: 'text', text: '我的角色' }]
      if (kind === 'renamed') session.name = '我的故事'
      if (kind === 'forked') session.messageForksHash = { test: { position: 0, lists: [], createdAt: 1 } }
      if (kind === 'threaded') session.threads = [{ id: 'chapter', name: 'Chapter', messages: [], createdAt: 1 }]
      if (kind === 'attachment') session.messages[0].contentParts = [{ type: 'image', storageKey: 'my-picture' }]
      if (kind === 'settings') session.settings = { modelId: 'my-model' }
      expect(await isUnmodifiedExample(session)).toBe(false)
    }
  )
  it('backs up before deleting and runs once', async () => {
    const session = example()
    const key = `session:${session.id}`
    records.set(key, session)
    localStorage.setItem('currentSessionId', session.id)
    await migrateToMomoRoleplay()
    expect(records.get(backupKey)).toEqual({ [session.id]: session })
    expect(records.has(key)).toBe(false)
    expect(metaDelete).toHaveBeenCalledWith(session.id)
    expect(writes.mock.invocationCallOrder[0]).toBeLessThan(metaDelete.mock.invocationCallOrder[0])
    expect(records.get(cleanupKey)).toBe(true)
    expect(localStorage.getItem('currentSessionId')).toBeNull()
    await migrateToMomoRoleplay()
    expect(metaDelete).toHaveBeenCalledOnce()
  })
  it('retains user and malformed records', async () => {
    const user = { ...example(), id: 'user-session' }
    const malformed = { id: example().id, messages: 'broken' }
    records.set('session:user-session', user)
    records.set(`session:${example().id}`, malformed)
    await migrateToMomoRoleplay()
    expect(records.get('session:user-session')).toEqual(user)
    expect(records.get(`session:${example().id}`)).toEqual(malformed)
    expect(metaDelete).not.toHaveBeenCalled()
  })
  it('stops on a corrupt backup without deleting anything', async () => {
    records.set(backupKey, ['corrupt'])
    records.set(`session:${example().id}`, example())
    await expect(migrateToMomoRoleplay()).rejects.toThrow()
    expect(metaDelete).not.toHaveBeenCalled()
    expect(records.get(cleanupKey)).toBeUndefined()
  })
  it('leaves the migration retryable if removal fails after backup', async () => {
    records.set(`session:${example().id}`, example())
    metaDelete.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(migrateToMomoRoleplay()).rejects.toThrow('storage unavailable')
    expect(records.has(backupKey)).toBe(true)
    expect(records.get(cleanupKey)).toBeUndefined()
    await migrateToMomoRoleplay()
    expect(records.get(cleanupKey)).toBe(true)
  })
  it('clears cloud credentials while retaining independent API configuration', () => {
    const settings = SettingsSchema.parse({
      ...defaultSettings(),
      providers: {
        'chatbox-ai': { apiKey: 'retired' },
        openai: { apiKey: 'test-only', apiHost: 'http://localhost:1234', activeAuthMode: 'oauth' },
      },
      licenseKey: 'retired',
      defaultChatModel: { provider: 'chatbox-ai', model: 'retired' },
      favoritedModels: [{ provider: 'chatbox-ai', model: 'retired' }],
    })
    const result = removeRetiredServiceSettings(settings)
    expect(result.providers?.['chatbox-ai']).toBeUndefined()
    expect(result.providers?.openai?.apiKey).toBe('test-only')
    expect(result.providers?.openai?.apiHost).toBe('http://localhost:1234')
    expect(result.providers?.openai?.activeAuthMode).toBe('apikey')
    expect(result.licenseKey).toBeUndefined()
    expect(result.defaultChatModel).toBeUndefined()
    expect(result.favoritedModels).toEqual([])
  })
})
