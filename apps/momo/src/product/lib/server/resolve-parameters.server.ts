import {
  purposeNames,
  modelsForPurpose,
  type Parameters,
  type ResolvedParameters,
  type ModelPurpose,
} from '../../contracts/parameters'
import type { Models } from '../../contracts/models'
import { CoreError } from './core.server'

export function validatePurposeModels(current: Parameters, catalog: Models) {
  for (const purpose of Object.keys(purposeNames) as ModelPurpose[]) {
    const id = current.purposes?.[purpose]
    if (id && !modelsForPurpose(catalog, purpose).some((m) => m.id === id))
      throw new CoreError(400, 'invalid_purpose_model', `${purposeNames[purpose]}的模型类型不符合用途，请重新选择。`)
  }
  if (current.embedding) {
    const model = catalog.models.find((m) => m.id === current.embedding?.modelId && m.kind === 'embedding')
    const provider = catalog.providers.find((p) => p.id === model?.provider_id)
    if (!model || !provider || !['openai', 'openai_responses'].includes(provider.protocol))
      throw new CoreError(400, 'invalid_embedding_model', '请选择提供 OpenAI 兼容向量化接口的向量化模型。')
  }
}

export function resolveParameters(current: Parameters, catalog?: Models): ResolvedParameters {
  const selected = current.groups.find((g) => g.id === current.selectedId)!
  const reference = (id: string | null | undefined) => {
    if (!id) {
      if (catalog) throw new CoreError(409, 'model_not_selected', '请先添加服务商，并选择一个对话模型。')
      return 'conversation'
    }
    const model = catalog?.models.find((m) => m.id === id && m.kind !== 'embedding')
    if (!model?.reference) throw new CoreError(409, 'model_unavailable', '所选模型已不可用，请在模型参数中重新选择。')
    return model.reference
  }
  const group: ResolvedParameters = { ...selected, modelReference: reference(selected.modelId) }
  if (catalog) validatePurposeModels(current, catalog)
  group.modelRoutes = {}
  for (const purpose of Object.keys(purposeNames) as ModelPurpose[]) {
    const id = current.purposes?.[purpose]
    const modelId = id ?? selected.modelId
    if (purpose === 'vision' && !catalog?.models.some((m) => m.id === modelId && m.kind === 'vision')) continue
    group.modelRoutes[purpose] = { model: reference(modelId) }
  }
  if (catalog) {
    const model = catalog.models.find((m) => m.id === current.embedding?.modelId)
    group.embedding =
      current.embedding && model?.reference
        ? { model: model.reference, dimension: current.embedding.dimension }
        : { model: null, dimension: null }
  }
  return group
}
