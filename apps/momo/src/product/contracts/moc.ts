import { record, uuid, list } from './core'
import { promptChoices } from './prompts'
export const spaceConfigNames = {
  history_window: '上下文管理',
  request_overrides: '请求参数策略',
  runtime: '记忆与语义网自动维护',
  memory_lifecycle: '记忆生命周期',
  mo_state: 'MO State',
  state_contract: '状态契约',
  roleplay: '角色扮演策略',
  vision: '视觉输入策略',
} as const
export const globalConfigNames = {
  models: '服务商与模型连接',
  parameters: '模型参数组与功能模型',
  preferences: '通用与对话界面设置',
} as const
export type SpaceConfig = keyof typeof spaceConfigNames
export type GlobalConfig = keyof typeof globalConfigNames
export type ConfigurationSelection = {
  global: GlobalConfig[]
  prompts: string[]
  personal_spaces: string[]
  spaces: Partial<Record<SpaceConfig, string[]>>
}
export function configurationSelection(input: unknown): ConfigurationSelection {
  if (input === undefined) return { global: [], prompts: [], personal_spaces: [], spaces: {} }
  const raw = record(input)
  if (Object.keys(raw).some((k) => !['global', 'prompts', 'personal_spaces', 'spaces'].includes(k)))
    throw Error('未知配置导出组件')
  const unique = <T>(values: T[]) => {
    if (new Set(values).size !== values.length) throw Error('重复导出选择')
    return values
  }
  const global = unique(
    list(raw.global, (v) => {
      if (typeof v !== 'string' || !Object.hasOwn(globalConfigNames, v)) throw Error('未知配置组件')
      return v as GlobalConfig
    })
  )
  const prompts = unique(
    list(raw.prompts, (v) => {
      if (typeof v !== 'string' || !Object.hasOwn(promptChoices, v)) throw Error('未知提示词空间')
      return v
    })
  )
  const source = record(raw.spaces)
  const spaces: ConfigurationSelection['spaces'] = {}
  for (const [key, ids] of Object.entries(source)) {
    if (!Object.hasOwn(spaceConfigNames, key)) throw Error('未知个人空间配置')
    spaces[key as SpaceConfig] = unique(list(ids, uuid))
  }
  return { global, prompts, personal_spaces: unique(list(raw.personal_spaces, uuid)), spaces }
}
export function configurationCount(selection: ConfigurationSelection) {
  return (
    selection.global.length +
    selection.prompts.length +
    selection.personal_spaces.length +
    Object.values(selection.spaces).reduce((sum, values) => sum + (values?.length ?? 0), 0)
  )
}

/** Only the browser preference contract is accepted, never arbitrary localStorage. */
export function portablePreferences(input: unknown) {
  const raw = record(input)
  const booleans = [
    'showAvatar',
    'hideSystemPromptMessage',
    'autoScrollNewMessagesToTop',
    'showWordCount',
    'showTokenUsed',
    'showModelName',
    'showMessageTimestamp',
    'showFirstTokenLatency',
    'autoGenerateTitle',
    'spellCheck',
    'enableMarkdownRendering',
    'stream',
  ]
  const special = [
    'language',
    'theme',
    'fontSize',
    'startupPage',
    'interfaceColors',
    'interfaceColorPresets',
    'backgroundImageOpacity',
    'messageLayout',
  ]
  // File keys are local references, so the portable snapshot excludes them.
  const localKeys = ['userAvatarKey', 'defaultAssistantAvatarKey', 'backgroundImageKey']
  if (Object.keys(raw).some((key) => ![...booleans, ...special, ...localKeys].includes(key)))
    throw Error('未知界面配置')
  const values: Record<string, unknown> = {}
  for (const key of booleans)
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'boolean') throw Error('无效界面开关')
      values[key] = raw[key]
    }
  function choice(key: string, options: unknown[]) {
    if (raw[key] !== undefined) {
      if (!options.includes(raw[key])) throw Error('无效界面配置')
      values[key] = raw[key]
    }
  }
  choice('language', ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko'])
  choice('theme', [0, 1, 2])
  choice('startupPage', ['home', 'session'])
  choice('messageLayout', ['left', 'bubble'])
  for (const [key, min, max] of [
    ['fontSize', 10, 22],
    ['backgroundImageOpacity', 0, 1],
  ] as const)
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || raw[key] < min || raw[key] > max)
        throw Error('无效界面数值')
      values[key] = raw[key]
    }
  const colors = (input: unknown) => {
    const source = record(input)
    return Object.fromEntries(
      ['light', 'dark'].map((mode) => {
        const fields = record(source[mode])
        return [
          mode,
          Object.fromEntries(
            ['backgroundPrimary', 'backgroundSecondary', 'backgroundTertiary', 'brand'].map((key) => {
              if (typeof fields[key] !== 'string' || !/^#[\da-f]{6}$/i.test(fields[key])) throw Error('无效界面颜色')
              return [key, fields[key]]
            })
          ),
        ]
      })
    )
  }
  if (raw.interfaceColors !== undefined) values.interfaceColors = colors(raw.interfaceColors)
  if (raw.interfaceColorPresets !== undefined) {
    if (!Array.isArray(raw.interfaceColorPresets) || raw.interfaceColorPresets.length > 20) throw Error('无效配色预设')
    values.interfaceColorPresets = raw.interfaceColorPresets.map((v) => {
      const p = record(v)
      if (typeof p.id !== 'string' || p.id.length > 100 || typeof p.label !== 'string' || p.label.length > 100)
        throw Error('无效配色预设')
      return { id: p.id, label: p.label, colors: colors(p.colors) }
    })
  }
  return values
}
