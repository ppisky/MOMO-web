import { record, list, text } from './core'

export const promptChoices = {
  assistant: '通用助手提示词',
  vision_fallback: '视觉回退提示词',
  roleplay_director: '角色导演提示词',
  memory_distillation: '记忆提取提示词',
  semantic_graph_governance: '语义网维护提示词',
  ddm_profile_generation: 'DDM 角色侧写提示词',
} as const

export function promptSpaces(input: unknown) {
  const entries = list(input, (value) => {
    const p = record(value)
    const id = text(p.id, 'id')
    const source = p.source
    if (!Object.hasOwn(promptChoices, id) || (source !== 'builtin' && source !== 'override'))
      throw Error('无效提示词空间来源')
    return { id, content: text(p.content, 'content'), source, revision: text(p.revision, 'revision') }
  })
  if (new Set(entries.map((p) => p.id)).size !== entries.length) throw Error('重复提示词空间')
  return entries
}
