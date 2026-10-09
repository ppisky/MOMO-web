import { record, text, uuid } from './core';
export type ParameterGroup = {
  id: string;
  name: string;
  modelId?: string | null;
  temperature: number | null;
  topP: number | null;
  maxOutput: number | null;
};
export const purposeNames = {
  vision: '视觉描述',
  memory_distillation: '记忆提取与人物状态',
  semantic_graph_governance: '语义网整理',
} as const;
export type ModelPurpose = keyof typeof purposeNames;
export type Parameters = {
  revision: number;
  selectedId: string;
  groups: ParameterGroup[];
  purposes?: Partial<Record<ModelPurpose, string | null>>;
};
export type ResolvedParameters = ParameterGroup & {
  modelReference?: string;
  modelRoutes?: Record<
    string,
    { model: string; temperature: number | null; top_p: number | null; max_output_tokens: number | null }
  >;
};
export function parameters(value: unknown): Parameters {
  const v = record(value);
  if (
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    !Array.isArray(v.groups) ||
    !v.groups.length ||
    v.groups.length > 100
  )
    throw Error('无效参数配置');
  function nullable(value: unknown, min: number, max: number, integer = false): number | null {
    if (value === null) return null;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      throw Error('模型参数超出范围');
    return value;
  }
  const groups = v.groups.map((raw) => {
    const g = record(raw);
    const name = text(g.name, 'name').trim();
    if (!name || name.length > 100) throw Error('参数组名称不能为空');
    return {
      id: uuid(g.id),
      name,
      modelId: g.modelId == null ? null : uuid(g.modelId),
      temperature: nullable(g.temperature, 0, 2),
      topP: nullable(g.topP, 0, 1),
      maxOutput: nullable(g.maxOutput, 1, 1000000, true),
    };
  });
  const selectedId = uuid(v.selectedId);
  if (!groups.some((g) => g.id === selectedId) || new Set(groups.map((g) => g.id)).size !== groups.length)
    throw Error('参数组不存在或重复');
  const rawPurposes = v.purposes == null ? {} : record(v.purposes);
  if (Object.keys(rawPurposes).some((k) => !(k in purposeNames))) throw Error('未知模型用途');
  const purposes: Parameters['purposes'] = {};
  for (const key of Object.keys(purposeNames) as ModelPurpose[]) {
    const id = rawPurposes[key] == null ? null : uuid(rawPurposes[key]);
    if (id && !groups.some((g) => g.id === id)) throw Error('用途参数组不存在');
    purposes[key] = id;
  }
  return { revision: Number(v.revision), selectedId, groups, purposes };
}
export function requestParameters(group: ParameterGroup) {
  return {
    ...(group.temperature === null ? {} : { temperature: group.temperature }),
    ...(group.topP === null ? {} : { parameters: { top_p: group.topP } }),
    ...(group.maxOutput === null ? {} : { max_output_tokens: group.maxOutput }),
  };
}

/** Validate a frozen host snapshot before replaying it across process/restart boundaries. */
export function resolvedParameters(input: unknown): ResolvedParameters {
  const raw = record(input), id = uuid(raw.id);
  const group = parameters({ revision: 0, selectedId: id, groups: [raw] }).groups[0]!;
  const reference = (v: unknown) => { const value = text(v, 'model reference'); if (!value || value.length > 512) throw Error('无效模型引用'); return value; };
  const result: ResolvedParameters = { ...group };
  if (raw.modelReference !== undefined) result.modelReference = reference(raw.modelReference);
  if (raw.modelRoutes !== undefined) {
    const routes = record(raw.modelRoutes);
    if (Object.keys(routes).some(key => !(key in purposeNames))) throw Error('未知模型用途');
    result.modelRoutes = Object.fromEntries(Object.entries(routes).map(([purpose, value]) => {
      const route = record(value);
      const validated = parameters({ revision: 0, selectedId: id, groups: [{ id, name: group.name, temperature: route.temperature, topP: route.top_p, maxOutput: route.max_output_tokens }] }).groups[0]!;
      return [purpose, { model: reference(route.model), temperature: validated.temperature, top_p: validated.topP, max_output_tokens: validated.maxOutput }];
    }));
  }
  return result;
}
