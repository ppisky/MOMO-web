import { isMomoProvider } from '@shared/momo-policy'
import { type Session, SessionSchema, type Settings, SettingsSchema } from '@shared/types'
import { z } from 'zod'
import storage, { StorageKey } from '@/storage'
import { StorageKeyGenerator } from '@/storage/StoreStorage'
import { getMetaStorage } from '@/stores/sessionHelpers'
import manifest from './retired-example-manifest.json'

const CLEANUP_KEY = 'momo:roleplay-migration:v1'
const BACKUP_KEY = 'momo:retired-examples-backup:v1'

/** Match content as well as ID: continued or edited examples belong to the user. */
export async function isUnmodifiedExample(session: Session): Promise<boolean> {
  const template = Object.entries(manifest).find(([id]) => id === session.id)?.[1]
  if (!template || template.name !== session.name || template.type !== session.type) return false
  if (session.threads?.length || Object.keys(session.messageForksHash ?? {}).length) return false
  if (session.copilotId || session.backgroundImage || session.assistantAvatarKey || session.compactionPoints?.length)
    return false
  if (session.settings && Object.keys(session.settings).length > 0) return false
  if (
    session.messages.some(
      (message) =>
        message.files?.length || message.links?.length || message.contentParts.some((part) => part.type !== 'text')
    )
  )
    return false
  const content = JSON.stringify(
    session.messages.map((message) => [
      message.id,
      message.role,
      message.contentParts.map((part) => [part.type, part.type === 'text' ? part.text : undefined]),
    ])
  )
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  const digest = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return digest === template.digest
}

export function removeRetiredServiceSettings(settings: Settings): Settings {
  const result = { ...settings, providers: { ...settings.providers } }
  for (const id of Object.keys(result.providers)) {
    if (!isMomoProvider(id)) delete result.providers[id]
    else result.providers[id] = { ...result.providers[id], oauth: undefined, activeAuthMode: 'apikey' }
  }
  result.licenseKey = undefined
  result.licenseDetail = undefined
  result.licenseInstances = undefined
  result.licensePlanName = undefined
  result.licenseActivationMethod = undefined
  result.hasExpiredLicense = false
  result.allowReportingAndTracking = false
  result.autoUpdate = false
  result.betaUpdate = false
  result.defaultChatModel = isMomoProvider(result.defaultChatModel?.provider) ? result.defaultChatModel : undefined
  result.favoritedModels = result.favoritedModels?.filter((model) => isMomoProvider(model.provider))
  result.mcp = { servers: [], enabledBuiltinServers: [] }
  result.skills = { ...result.skills, enabledSkillNames: [], appliedDefaultBuiltinSkillNames: [] }
  return result
}

/** Runs after upstream storage upgrades and before settings/session hydration. Safe to retry. */
export async function migrateToMomoRoleplay(): Promise<void> {
  if ((await storage.getItem<unknown>(CLEANUP_KEY, false)) === true) return
  const meta = await getMetaStorage()
  // A corrupt backup must stop cleanup rather than overwrite recoverable data.
  const backup = z.record(z.string(), z.unknown()).parse(await storage.getItem<unknown>(BACKUP_KEY, {}))
  for (const id of Object.keys(manifest)) {
    const key = StorageKeyGenerator.session(id)
    const raw = await storage.getItem<unknown>(key, null)
    const parsed = SessionSchema.safeParse(raw)
    if (!parsed.success) continue
    if (await isUnmodifiedExample(parsed.data)) {
      // Write a recoverable copy before removing either durable record.
      backup[id] = raw
      await storage.setItemNow(BACKUP_KEY, backup)
      await meta.delete(id)
      await storage.removeItem(key)
      if (localStorage.getItem('currentSessionId') === id) localStorage.removeItem('currentSessionId')
    }
  }
  const settings = SettingsSchema.safeParse(await storage.getItem<unknown>(StorageKey.Settings, null))
  if (settings.success) await storage.setItemNow(StorageKey.Settings, removeRetiredServiceSettings(settings.data))
  await storage.removeItem(StorageKey.AuthInfo)
  await storage.removeItem(StorageKey.RemoteConfig)
  await storage.setItemNow(CLEANUP_KEY, true)
}
