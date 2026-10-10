import type { ActionFunctionArgs } from '../lib/server/handler-types'
import { actionError, actionInput, core } from '../lib/server/actions.server'
import { models, modelWrite } from '../contracts/models'
import { uuid } from '../contracts/core'
import { readParameters } from '../lib/server/parameters.server'
import { CoreError } from '../lib/server/core.server'
import { validatePurposeModels } from '../lib/server/resolve-parameters.server'
export async function loader() {
  try {
    return Response.json(models(await (await core().request('/v1/model-configuration')).json()), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return actionError(e)
  }
}
export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request)
    if (input.command === 'discover')
      return Response.json(
        await (await core().request(`/v1/model-configuration/providers/${uuid(input.providerId)}/models`)).json()
      )
    const value = modelWrite(input)
    validatePurposeModels(readParameters(), models(input, true))
    if (
      readParameters().groups.some(
        (g) => g.modelId && !value.models.some((m) => m.id === g.modelId && m.kind !== 'embedding')
      )
    )
      throw new CoreError(409, 'model_in_use', '此模型仍被参数组使用，请先在模型参数中更换模型。')
    return Response.json(
      models(
        await (await core().request('/v1/model-configuration', { method: 'PUT', body: JSON.stringify(value) })).json()
      )
    )
  } catch (e) {
    return actionError(e)
  }
}
