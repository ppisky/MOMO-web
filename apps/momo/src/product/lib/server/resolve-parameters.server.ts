import { purposeNames, type Parameters, type ResolvedParameters, type ModelPurpose } from '../../contracts/parameters';
import type { Models } from '../../contracts/models';
import { CoreError } from './core.server';

export function resolveParameters(current: Parameters, catalog?: Models): ResolvedParameters {
  const selected = current.groups.find((g) => g.id === current.selectedId)!;
  const reference = (id: string | null | undefined) => {
    if (!id) {
      if (catalog) throw new CoreError(409, 'model_not_selected', '请先添加服务商，并选择一个对话模型。');
      return 'conversation';
    }
    const model = catalog?.models.find((m) => m.id === id && m.kind !== 'embedding');
    if (!model?.reference)
      throw new CoreError(409, 'model_unavailable', '所选模型已不可用，请在模型参数中重新选择。');
    return model.reference;
  };
  const group: ResolvedParameters = { ...selected, modelReference: reference(selected.modelId) };
  group.modelRoutes = Object.fromEntries(
    (Object.keys(purposeNames) as ModelPurpose[]).map((purpose) => {
      const id = current.purposes?.[purpose];
      const source = id ? current.groups.find((g) => g.id === id)! : selected;
      return [
        purpose,
        {
          model: reference(source.modelId),
          temperature: source.temperature,
          top_p: source.topP,
          max_output_tokens: source.maxOutput,
        },
      ];
    }),
  );
  return group;
}
