import type { ActionFunctionArgs } from '../lib/server/handler-types'
import { actionError, actionInput, core } from '../lib/server/actions.server'
import { record, uuid } from '../contracts/core'
import { models } from '../contracts/models'
import {
  embeddingParameters,
  modelsForPurpose,
  purposeNames,
  purposeRouteParameters,
  type ModelPurpose,
} from '../contracts/parameters'
import { purposeConfigurations } from '../contracts/purpose-parameters'
import { CoreError } from '../lib/server/core.server'

export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request),
      spaceId = uuid(input.spaceId),
      client = core(spaceId)
    const purpose = String(input.purpose)
    if (!Object.hasOwn(purposeNames, purpose) && purpose !== 'embedding') throw new CoreError(400, 'invalid_purpose')
    const catalog = models(await (await client.request('/v1/model-configuration')).json())
    const model = modelsForPurpose(catalog, purpose as ModelPurpose | 'embedding').find(
      (m) => m.id === uuid(input.modelId)
    )
    if (!model?.reference) throw new CoreError(400, 'invalid_purpose_model', '请先选择符合用途的模型。')
    const values = input.parameters === undefined ? {} : record(input.parameters)
    const payload =
      purpose === 'embedding'
        ? { embedding: { model: model.reference, dimension: input.dimension, parameters: embeddingParameters(values) } }
        : { model_routes: { [purpose]: { model: model.reference, ...purposeRouteParameters(values) } } }
    const result = await (
      await client.request('/v1/momo/model-requests/resolve', {
        method: 'POST',
        body: JSON.stringify({ personal_space_id: spaceId, ...payload }),
      })
    ).json()
    return Response.json(
      { version: 1, purposes: purposeConfigurations(result) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return actionError(error)
  }
}
