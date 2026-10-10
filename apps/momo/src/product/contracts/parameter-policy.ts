import { record, uuid } from './core';

/** Read only the Core policy fields this product exposes; Core remains the validator. */
export function parameterPolicy(value: unknown) {
  const resource = record(value);
  const policy = record(record(resource.settings).request_overrides);
  if (!Number.isSafeInteger(resource.revision) || Number(resource.revision) < 0)
    throw Error('无法读取空间策略版本');
  const mode = (value: unknown) => {
    if (value !== 'allow' && value !== 'ignore' && value !== 'reject') throw Error('无效参数策略');
    return value;
  };
  if (!Array.isArray(policy.allowed_parameters) || !policy.allowed_parameters.every((p) => typeof p === 'string'))
    throw Error('无效参数许可');
  return {
    spaceId: uuid(resource.space_id),
    revision: Number(resource.revision),
    sampling: mode(policy.sampling),
    maxOutput: mode(policy.max_output_tokens),
    allowedParameters: policy.allowed_parameters as string[],
  };
}

export function enableParameterPolicy(value: ReturnType<typeof parameterPolicy>, extraNames: string[] = []) {
  return {
    request_overrides: {
      sampling: 'allow',
      max_output_tokens: 'allow',
      allowed_parameters: [...new Set([...value.allowedParameters, 'top_p', ...extraNames])],
    },
  };
}
