import type { ActionFunctionArgs } from '../lib/server/handler-types';
import { actionError, actionInput, core } from '../lib/server/actions.server';
import { parameters } from '../contracts/parameters';
import { models } from '../contracts/models';
import { CoreError } from '../lib/server/core.server';
import { readParameters, saveParameters } from '../lib/server/parameters.server';
export function loader() {
  return Response.json(readParameters(), { headers: { 'Cache-Control': 'no-store' } });
}
export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request);
    const value = parameters(input);
    const catalog = models(await (await core().request('/v1/model-configuration')).json());
    for (const group of value.groups)
      if (group.modelId && !catalog.models.some((m) => m.id === group.modelId && m.kind !== 'embedding'))
        throw new CoreError(400, 'invalid_generation_model', '请选择对话或视觉模型。');
    if (readParameters().revision !== value.revision) throw new CoreError(409, 'parameter_revision_changed');
    // Parameter groups are App-owned. Core policy has its own explicit operation.
    return Response.json(saveParameters(value));
  } catch (e) {
    return actionError(e);
  }
}
