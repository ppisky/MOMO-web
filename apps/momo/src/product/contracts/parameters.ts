import { record, text, uuid } from './core'
import type { Models } from './models'
export type ParameterGroup = {
  id: string
  name: string
  modelId?: string | null
  temperature: number | null
  topP: number | null
  maxOutput: number | null
  parameters?: Record<string, unknown>
}
export const purposeNames = {
  vision: '视觉回退模型',
  memory_distillation: '记忆提取与人物状态',
  semantic_graph_governance: '语义网整理',
} as const
export type ModelPurpose = keyof typeof purposeNames
export function modelsForPurpose(catalog: Models | null | undefined, purpose: ModelPurpose | 'embedding') {
  return (
    catalog?.models.filter((model) =>
      purpose === 'vision'
        ? model.kind === 'vision'
        : purpose === 'embedding'
          ? model.kind === 'embedding'
          : model.kind !== 'embedding'
    ) ?? []
  )
}
export type Parameters = {
  revision: number
  selectedId: string
  groups: ParameterGroup[]
  purposes?: Partial<Record<ModelPurpose, string | null>>
  purposeParameters?: Partial<Record<ModelPurpose, Record<string, unknown>>>
  embedding?: { modelId: string; dimension: number | null; parameters?: Record<string, unknown> } | null
}
export type ResolvedParameters = ParameterGroup & {
  stream?: boolean
  modelReference?: string
  embedding?: { model: string | null; dimension: number | null; parameters?: Record<string, unknown> }
  modelRoutes?: Record<
    string,
    {
      model: string
      temperature?: number | null
      top_p?: number | null
      max_output_tokens?: number | null
      parameters?: Record<string, unknown>
    }
  >
}
export function parameters(value: unknown): Parameters {
  const v = record(value)
  if (
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    !Array.isArray(v.groups) ||
    !v.groups.length ||
    v.groups.length > 100
  )
    throw Error('无效参数配置')
  function nullable(value: unknown, min: number, max: number, integer = false): number | null {
    if (value === null) return null
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw Error('模型参数超出范围')
    return value
  }
  const groups = v.groups.map((raw) => {
    const g = record(raw)
    const name = text(g.name, 'name').trim()
    if (!name || name.length > 100) throw Error('参数组名称不能为空')
    return {
      id: uuid(g.id),
      name,
      modelId: g.modelId == null ? null : uuid(g.modelId),
      temperature: nullable(g.temperature, 0, 2),
      topP: nullable(g.topP, 0, 1),
      maxOutput: nullable(g.maxOutput, 1, 1000000, true),
      ...(g.parameters === undefined ? {} : { parameters: extraParameters(g.parameters) }),
    }
  })
  const selectedId = uuid(v.selectedId)
  if (!groups.some((g) => g.id === selectedId) || new Set(groups.map((g) => g.id)).size !== groups.length)
    throw Error('参数组不存在或重复')
  const rawPurposes = v.purposes == null ? {} : record(v.purposes)
  if (Object.keys(rawPurposes).some((k) => !Object.hasOwn(purposeNames, k))) throw Error('未知模型用途')
  const purposes: Parameters['purposes'] = {}
  for (const key of Object.keys(purposeNames) as ModelPurpose[]) {
    const id = rawPurposes[key] == null ? null : uuid(rawPurposes[key])
    const legacyGroup = groups.find((g) => g.id === id)
    purposes[key] = legacyGroup ? legacyGroup.modelId : id
  }
  let embedding: Parameters['embedding']
  if (v.embedding != null) {
    const e = record(v.embedding)
    embedding = { modelId: uuid(e.modelId), dimension: nullable(e.dimension, 1, 8192, true),
      ...(e.parameters === undefined ? {} : { parameters: embeddingParameters(e.parameters) }) }
    if (embedding.dimension === null) throw Error('请填写向量维数')
  }
  const purposeParameters: Parameters['purposeParameters'] = {}
  if (v.purposeParameters !== undefined) {
    for (const [purpose, value] of Object.entries(record(v.purposeParameters))) {
      if (!Object.hasOwn(purposeNames, purpose)) throw Error('未知模型用途')
      const custom = purposeParameterJson(value)
      if (Object.keys(custom).length) purposeParameters[purpose as ModelPurpose] = custom
    }
  }
  return {
    revision: Number(v.revision),
    selectedId,
    groups,
    purposes,
    ...(Object.keys(purposeParameters).length ? { purposeParameters } : {}),
    ...(v.embedding === undefined ? {} : { embedding: embedding ?? null }),
  }
}
export function requestParameters(group: ParameterGroup) {
  const extra = { ...group.parameters, ...(group.topP === null ? {} : { top_p: group.topP }) }
  return {
    ...(group.temperature === null ? {} : { temperature: group.temperature }),
    ...(Object.keys(extra).length ? { parameters: extra } : {}),
    ...(group.maxOutput === null ? {} : { max_output_tokens: group.maxOutput }),
  }
}

/** Validate a frozen host snapshot before replaying it across process/restart boundaries. */
export function resolvedParameters(input: unknown): ResolvedParameters {
  const raw = record(input),
    id = uuid(raw.id)
  const group = parameters({ revision: 0, selectedId: id, groups: [raw] }).groups[0]!
  const reference = (v: unknown) => {
    const value = text(v, 'model reference')
    if (!value || value.length > 512) throw Error('无效模型引用')
    return value
  }
  const result: ResolvedParameters = { ...group }
  if (raw.stream !== undefined) {
    if (typeof raw.stream !== 'boolean') throw Error('stream 必须为 true 或 false')
    result.stream = raw.stream
  }
  if (raw.modelReference !== undefined) result.modelReference = reference(raw.modelReference)
  if (raw.embedding !== undefined) {
    const e = record(raw.embedding)
    if (e.model === null && e.dimension === null) result.embedding = { model: null, dimension: null }
    else {
      if (!Number.isInteger(e.dimension) || Number(e.dimension) < 1 || Number(e.dimension) > 8192)
        throw Error('无效向量维数')
      result.embedding = { model: reference(e.model), dimension: Number(e.dimension),
        ...(e.parameters === undefined ? {} : { parameters: embeddingParameters(e.parameters) }) }
    }
  }
  if (raw.modelRoutes !== undefined) {
    const routes = record(raw.modelRoutes)
    if (Object.keys(routes).some((key) => !Object.hasOwn(purposeNames, key))) throw Error('未知模型用途')
    result.modelRoutes = Object.fromEntries(
      Object.entries(routes).map(([purpose, value]) => {
        const route = record(value)
        const validated = parameters({
          revision: 0,
          selectedId: id,
          groups: [
            {
              id,
              name: group.name,
              temperature: route.temperature ?? null,
              topP: route.top_p ?? null,
              maxOutput: route.max_output_tokens ?? null,
              parameters: route.parameters,
            },
          ],
        }).groups[0]!
        return [
          purpose,
          {
            model: reference(route.model),
            ...(route.temperature === undefined ? {} : { temperature: validated.temperature }),
            ...(route.top_p === undefined ? {} : { top_p: validated.topP }),
            ...(route.max_output_tokens === undefined ? {} : { max_output_tokens: validated.maxOutput }),
            ...(validated.parameters ? { parameters: validated.parameters } : {}),
          },
        ]
      })
    )
  }
  return result
}

const reservedParameters = new Set([
  'model',
  'messages',
  'input',
  'stream',
  'context_window',
  'max_tokens',
  'max_output_tokens',
  'temperature',
  'top_p',
  'tools',
  'tool_choice',
  'momo',
  'metadata',
  'base_url',
  'api_key',
  'url',
  'headers',
  '__proto__',
  'constructor',
  'prototype',
])
export function extraParameters(value: unknown): Record<string, unknown> {
  const fields = record(value)
  if (Object.keys(fields).length > 64 || JSON.stringify(fields).length > 16384) throw Error('请求参数 JSON 过大')
  for (const key of Object.keys(fields))
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || reservedParameters.has(key))
      throw Error(`请求参数 ${key} 由应用或独立字段管理`)
  let count = 0
  function validate(value: unknown, depth: number) {
    if (++count > 2048 || depth > 10) throw Error('请求参数 JSON 过于复杂')
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return
    if (typeof value === 'number' && Number.isFinite(value)) return
    if (Array.isArray(value)) {
      value.forEach((v) => validate(v, depth + 1))
      return
    }
    if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
      Object.values(value).forEach((v) => validate(v, depth + 1))
      return
    }
    throw Error('请求参数必须是有效 JSON')
  }
  validate(fields, 0)
  return fields
}
export function parameterJson(group: ParameterGroup) {
  return {
    ...group.parameters,
    ...(group.temperature === null ? {} : { temperature: group.temperature }),
    ...(group.topP === null ? {} : { top_p: group.topP }),
    ...(group.maxOutput === null ? {} : { max_output_tokens: group.maxOutput }),
  }
}
export function groupFromJson(group: ParameterGroup, input: unknown): ParameterGroup {
  const { temperature, top_p, max_output_tokens, ...extra } = record(input)
  return parameters({
    revision: 0,
    selectedId: group.id,
    groups: [
      {
        ...group,
        temperature: temperature ?? null,
        topP: top_p ?? null,
        maxOutput: max_output_tokens ?? null,
        parameters: extraParameters(extra),
      },
    ],
  }).groups[0]!
}

export function requestParameterJson(group: ParameterGroup, stream: boolean) {
  return { ...parameterJson(group), stream }
}
export function requestFromJson(group: ParameterGroup, currentStream: boolean, input: unknown) {
  const { stream = currentStream, ...values } = record(input)
  if (typeof stream !== 'boolean') throw Error('stream 必须为 true 或 false')
  return { group: groupFromJson(group, values), stream }
}

export function purposeParameterJson(input: unknown): Record<string, unknown> {
  const group: ParameterGroup = { id: '00000000-0000-4000-8000-000000000011', name: '用途参数', temperature: null, topP: null, maxOutput: null }
  return parameterJson(groupFromJson(group, input))
}

export function purposeRouteParameters(input: unknown) {
  const { temperature, top_p, max_output_tokens, ...extra } = purposeParameterJson(input)
  return { ...(temperature === undefined ? {} : { temperature: Number(temperature) }),
    ...(top_p === undefined ? {} : { top_p: Number(top_p) }),
    ...(max_output_tokens === undefined ? {} : { max_output_tokens: Number(max_output_tokens) }),
    ...(Object.keys(extra).length ? { parameters: extra } : {}) }
}

export function embeddingParameters(input: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record(input))) {
    if (!['normalization', 'send_dimensions', 'query_prefix', 'document_prefix'].includes(key)) throw Error(`向量化不支持参数 ${key}`)
    if (value === null) continue
    if (key === 'normalization' && (typeof value !== 'string' || !['none', 'l2'].includes(value))) throw Error('normalization 必须为 none 或 l2')
    if (key === 'send_dimensions' && typeof value !== 'boolean') throw Error('send_dimensions 必须为 true 或 false')
    if (key.endsWith('_prefix') && (typeof value !== 'string' || new TextEncoder().encode(value).byteLength > 4096)) throw Error('向量化前缀必须为不超过 4096 字节的文本')
    result[key] = value
  }
  return result
}
