import type { Parameters } from '../../contracts/parameters'
import { modelsForPurpose, purposeNames, purposeRouteParameters, type ModelPurpose } from '../../contracts/parameters'
import type { Models } from '../../contracts/models'
import { purposeConfigurations } from '../../contracts/purpose-parameters'
import { core } from './actions.server'
import { CoreError } from './core.server'

/** Ask Core for canonical deltas; never embed its recommended values in host settings. */
export async function canonicalPurposeParameters(
  value: Parameters,
  catalog: Models,
  spaceId?: string
): Promise<Parameters> {
  if (!Object.keys(value.purposeParameters ?? {}).length && !value.embedding?.parameters) return value
  const client = core(spaceId),
    selected = value.groups.find((g) => g.id === value.selectedId)
  const routes: Record<string, unknown> = {}
  for (const purpose of Object.keys(value.purposeParameters ?? {}) as ModelPurpose[]) {
    const id = value.purposes?.[purpose] ?? selected?.modelId
    const model = modelsForPurpose(catalog, purpose).find((m) => m.id === id)
    if (!model?.reference)
      throw new CoreError(400, 'purpose_model_not_ready', `${purposeNames[purpose]}需要先选择模型。`)
    routes[purpose] = { model: model.reference, ...purposeRouteParameters(value.purposeParameters?.[purpose] ?? {}) }
  }
  const model = catalog.models.find((m) => m.id === value.embedding?.modelId)
  const result = purposeConfigurations(
    await (
      await client.request('/v1/momo/model-requests/resolve', {
        method: 'POST',
        body: JSON.stringify({
          personal_space_id: client.config.personalSpaceId,
          model_routes: routes,
          ...(value.embedding?.parameters
            ? {
                embedding: {
                  model: model?.reference,
                  dimension: value.embedding.dimension,
                  parameters: value.embedding.parameters,
                },
              }
            : {}),
        }),
      })
    ).json()
  )
  const custom: Parameters['purposeParameters'] = {}
  for (const purpose of Object.keys(routes) as ModelPurpose[]) {
    const row = result[purpose]
    if (!row) throw new CoreError(502, 'purpose_configuration_missing')
    if (Object.keys(row.overrides).length) custom[purpose] = row.overrides
  }
  const { purposeParameters: _previous, ...base } = value
  return {
    ...base,
    ...(Object.keys(custom).length ? { purposeParameters: custom } : {}),
    ...(value.embedding
      ? {
          embedding: (() => {
            const { parameters: _old, ...selection } = value.embedding
            const custom = result.embedding?.overrides ?? value.embedding.parameters
            return { ...selection, ...(custom && Object.keys(custom).length ? { parameters: custom } : {}) }
          })(),
        }
      : {}),
  }
}
