import { record, uuid } from '../../src/product/contracts/core'
import { models } from '../../src/product/contracts/models'
import {
  embeddingParameters,
  type ModelPurpose,
  modelsForPurpose,
  type Parameters,
  parameters,
  purposeNames,
  purposeParameterJson,
} from '../../src/product/contracts/parameters'
import { type PurposeConfiguration, parameterDifference } from '../../src/product/contracts/purpose-parameters'

// Offline demo only. The production entry never imports this adapter.
export const demoSpaceId = '10000000-0000-4000-8000-000000000001'
const providerId = '10000000-0000-4000-8000-000000000002'
const chatId = '10000000-0000-4000-8000-000000000003'
const visionId = '10000000-0000-4000-8000-000000000004'
const embeddingId = '10000000-0000-4000-8000-000000000005'
const groupId = '10000000-0000-4000-8000-000000000006'
const storageKey = 'momo-model-parameters-demo.v2'
const catalog = models({
  revision: 1,
  providers: [
    {
      id: providerId,
      name: '内置演示',
      protocol: 'openai',
      base_url: 'https://demo.invalid/v1',
      api_path: '',
      has_api_key: false,
    },
  ],
  models: [
    {
      id: chatId,
      provider_id: providerId,
      name: '日常对话',
      model_id: 'demo-text',
      kind: 'chat',
      context_window: 65536,
      max_output_tokens: 16384,
      reference: `configured_${'a'.repeat(64)}`,
    },
    {
      id: visionId,
      provider_id: providerId,
      name: '视觉理解',
      model_id: 'demo-vision',
      kind: 'vision',
      context_window: 32768,
      max_output_tokens: 8192,
      reference: `configured_${'b'.repeat(64)}`,
    },
    {
      id: embeddingId,
      provider_id: providerId,
      name: '语义网向量化',
      model_id: 'demo-embedding',
      kind: 'embedding',
      context_window: null,
      max_output_tokens: null,
      reference: `configured_${'c'.repeat(64)}`,
    },
  ],
})
function initial(): Parameters {
  return parameters({
    revision: 0,
    selectedId: groupId,
    groups: [{ id: groupId, name: '默认参数', modelId: chatId, temperature: null, topP: null, maxOutput: null }],
    purposes: { vision: visionId },
    embedding: { modelId: embeddingId, dimension: null },
  })
}
function read(): Parameters {
  try {
    return parameters(JSON.parse(localStorage.getItem(storageKey) ?? 'null'))
  } catch {
    return initial()
  }
}
let saved = read()
let policy = {
  sampling: 'allow',
  max_output_tokens: 'allow',
  allowed_parameters: ['top_p', 'frequency_penalty', 'presence_penalty', 'seed'],
}
let policyRevision = 0

// Sample responses from the current Core contract; not a production default resolver.
function configuration(input: Record<string, unknown>): PurposeConfiguration {
  const purpose = String(input.purpose)
  if (purpose !== 'embedding' && !Object.hasOwn(purposeNames, purpose)) throw Error('未知模型用途')
  if (uuid(input.spaceId) !== demoSpaceId) throw Error('无效演示空间')
  const model = modelsForPurpose(catalog, purpose as ModelPurpose | 'embedding').find(
    (m) => m.id === uuid(input.modelId)
  )
  if (!model) throw Error('请先选择符合用途的模型。')
  let defaults: Record<string, unknown>, custom: Record<string, unknown>
  if (purpose === 'embedding') {
    if (
      input.dimension != null &&
      (!Number.isInteger(input.dimension) || Number(input.dimension) < 1 || Number(input.dimension) > 8192)
    )
      throw Error('请填写 1–8192 的向量维数')
    defaults = { encoding_format: 'float' }
    custom = embeddingParameters(input.parameters ?? {})
    if (input.dimension != null) custom = { ...custom, dimensions: input.dimension }
  } else {
    defaults = { temperature: 0, max_output_tokens: purpose === 'vision' ? 1024 : 4096 }
    custom = purposeParameterJson(input.parameters ?? {})
    if (Number(custom.max_output_tokens ?? 1) > Number(model.max_output_tokens))
      throw Error('最大输出超出此演示模型的能力。')
    const denied = Object.keys(custom).filter(
      (key) => !['temperature', 'max_output_tokens'].includes(key) && !policy.allowed_parameters.includes(key)
    )
    if (denied.length) throw Error(`请先允许当前个人空间使用参数：${denied.join('、')}`)
  }
  const overrides = parameterDifference(custom, defaults)
  return { defaults, effective: { ...defaults, ...overrides }, overrides, constraints: {}, ignored: [] }
}
function normalize(value: Parameters): Parameters {
  const purposeParameters: NonNullable<Parameters['purposeParameters']> = {}
  const selected = value.groups.find((g) => g.id === value.selectedId)
  for (const purpose of Object.keys(value.purposeParameters ?? {}) as ModelPurpose[]) {
    const row = configuration({
      spaceId: demoSpaceId,
      purpose,
      modelId: value.purposes?.[purpose] ?? selected?.modelId,
      parameters: value.purposeParameters?.[purpose],
    })
    if (Object.keys(row.overrides).length) purposeParameters[purpose] = row.overrides
  }
  const { purposeParameters: _old, ...next } = value
  if (value.embedding?.parameters) {
    const row = configuration({
      spaceId: demoSpaceId,
      purpose: 'embedding',
      modelId: value.embedding.modelId,
      dimension: value.embedding.dimension,
      parameters: value.embedding.parameters,
    })
    const { parameters: _oldEmbedding, ...selection } = value.embedding
    next.embedding = { ...selection, ...(Object.keys(row.overrides).length ? { parameters: row.overrides } : {}) }
  }
  return { ...next, ...(Object.keys(purposeParameters).length ? { purposeParameters } : {}) }
}
export function resetDemo() {
  localStorage.removeItem(storageKey)
  localStorage.removeItem('momo-app.ui.v1')
  window.location.reload()
}
export async function api(path: string, input?: unknown, signal?: AbortSignal): Promise<unknown> {
  await Promise.resolve()
  signal?.throwIfAborted()
  const url = new URL(path, window.location.origin)
  if (url.pathname === '/api/models' && input === undefined) return structuredClone(catalog)
  if (url.pathname === '/api/parameters') {
    if (input !== undefined) {
      const next = parameters(input)
      if (next.revision !== saved.revision) throw Error('演示配置已更新，请刷新后重试。')
      const normalized = { ...normalize(next), revision: saved.revision + 1 }
      localStorage.setItem(storageKey, JSON.stringify(normalized))
      saved = normalized
    }
    return structuredClone(saved)
  }
  if (url.pathname === '/api/purpose-parameters' && input !== undefined) {
    const value = record(input)
    return { version: 1, purposes: { [String(value.purpose)]: configuration(value) } }
  }
  if (url.pathname === '/api/resources') {
    if (input !== undefined) {
      const value = record(input)
      if (value.command !== 'runtime-save' || value.spaceId !== demoSpaceId || value.revision !== policyRevision)
        throw Error('无效演示操作')
      const proposed = record(record(value.patch).request_overrides)
      if (!Array.isArray(proposed.allowed_parameters) || proposed.allowed_parameters.some((v) => typeof v !== 'string'))
        throw Error('无效演示参数许可')
      policy = {
        sampling: 'allow',
        max_output_tokens: 'allow',
        allowed_parameters: proposed.allowed_parameters as string[],
      }
      policyRevision++
    } else if (url.searchParams.get('kind') !== 'runtime' || url.searchParams.get('space') !== demoSpaceId)
      throw Error('此演示仅提供模型参数')
    return { space_id: demoSpaceId, revision: policyRevision, settings: { request_overrides: structuredClone(policy) } }
  }
  throw Error('此演示仅提供模型参数，不连接真实服务。')
}
