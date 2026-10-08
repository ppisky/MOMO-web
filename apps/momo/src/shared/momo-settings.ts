/** 当前支持的界面语言；保留旧设置类型以便读取历史配置。 */
export const MOMO_LANGUAGES = ['zh-Hans', 'zh-Hant', 'ja', 'ko', 'en'] as const
export type MomoLanguage = (typeof MOMO_LANGUAGES)[number]

export function normalizeMomoLanguage(value: unknown): MomoLanguage {
  return MOMO_LANGUAGES.find((language) => language === value) ?? 'en'
}

/** 请求默认值和上次的手动选择相互独立；旧 defaultChatModel 不再参与。 */
export function getNewMomoSessionSettings(
  settings: Settings,
  lastModel?: Pick<SessionSettings, 'provider' | 'modelId'>
): SessionSettings {
  const custom = settings.customProviders?.find((provider) => provider.isCustom && provider.id === lastModel?.provider)
  const connection = custom ? settings.providers?.[custom.id] : undefined
  const selected =
    connection?.apiHost?.trim() && connection.models?.some((model) => model.modelId === lastModel?.modelId)
  return {
    maxContextMessageCount: settings.maxContextMessageCount ?? Number.MAX_SAFE_INTEGER,
    temperature: settings.temperature,
    topP: settings.topP,
    maxTokens: settings.maxTokens,
    stream: settings.stream,
    ...(selected ? lastModel : {}),
  }
}

import type { SessionSettings, Settings } from './types'
