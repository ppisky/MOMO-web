import { record, text, uuid } from './core';
export const protocols = [
  { value: 'openai', label: 'OpenAI Chat Completions' },
  { value: 'openai_responses', label: 'OpenAI Responses' },
  { value: 'anthropic', label: 'Anthropic Messages' },
  { value: 'gemini', label: 'Google Gemini' },
] as const;
export const modelKinds = [
  { value: 'chat', label: '对话' },
  { value: 'vision', label: '视觉' },
  { value: 'embedding', label: '向量化' },
] as const;
export type Provider = {
  id: string;
  name: string;
  protocol: (typeof protocols)[number]['value'];
  base_url: string;
  api_path: string;
  has_api_key: boolean;
  api_key?: string | undefined;
};
export type Model = {
  id: string;
  provider_id: string;
  model_id: string;
  name: string;
  kind: (typeof modelKinds)[number]['value'];
  context_window: number | null;
  max_output_tokens: number | null;
  reference?: string;
};
export type Models = { revision: number; providers: Provider[]; models: Model[] };
export function models(value: unknown, editing = false): Models {
  const v = record(value);
  if (
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    !Array.isArray(v.providers) ||
    v.providers.length > 64 ||
    !Array.isArray(v.models) ||
    v.models.length > 1024
  )
    throw Error('无效模型配置');
  const providers = v.providers.map((raw): Provider => {
    const p = record(raw);
    const protocol = protocols.find((o) => o.value === p.protocol)?.value;
    const name = text(p.name, 'name').trim(),
      base_url = text(p.base_url, 'base_url').trim(),
      api_path = text(p.api_path, 'api_path').trim();
    const url = new URL(base_url);
    if (
      !protocol ||
      !name ||
      name.length > 200 ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      api_path.length > 300 ||
      /[?#\\]/.test(api_path) ||
      api_path.split('/').includes('..')
    )
      throw Error('请检查服务商名称、协议和地址');
    const api_key = editing && typeof p.api_key === 'string' ? p.api_key : undefined;
    if (api_key && (api_key.length > 8192 || /[\r\n]/.test(api_key))) throw Error('无效 API Key');
    return {
      id: uuid(p.id),
      name,
      protocol,
      base_url,
      api_path,
      has_api_key: p.has_api_key === true,
      ...(api_key === undefined ? {} : { api_key }),
    };
  });
  const configured = v.models.map((raw): Model => {
    const m = record(raw);
    const kind = modelKinds.find((k) => k.value === m.kind)?.value;
    const name = text(m.name, 'name').trim(),
      model_id = text(m.model_id, 'model_id').trim();
    const context_window = m.context_window == null ? null : m.context_window,
      max_output_tokens = m.max_output_tokens === null ? null : Number(m.max_output_tokens);
    if (
      !kind ||
      !name ||
      name.length > 200 ||
      !model_id ||
      model_id.length > 256 ||
      (context_window !== null &&
        (typeof context_window !== 'number' || !Number.isInteger(context_window) ||
        context_window < 1024 || context_window > 16000000)) ||
      (max_output_tokens !== null &&
        (!Number.isInteger(max_output_tokens) ||
          max_output_tokens < 1 ||
          max_output_tokens >= 16000000 ||
          (typeof context_window === 'number' && max_output_tokens >= context_window)))
    )
      throw Error('请检查模型 ID 和上下文长度');
    const provider_id = uuid(m.provider_id);
    if (!providers.some((p) => p.id === provider_id)) throw Error('模型所属服务商不存在');
    const reference =
      typeof m.reference === 'string' && /^configured_[0-9a-f]{64}$/.test(m.reference)
        ? m.reference
        : undefined;
    if (!editing && !reference) throw Error('Core 未返回有效模型引用');
    return {
      id: uuid(m.id),
      provider_id,
      model_id,
      name,
      kind,
      context_window: context_window as number | null,
      max_output_tokens,
      ...(reference ? { reference } : {}),
    };
  });
  if (
    new Set(providers.map((p) => p.id)).size !== providers.length ||
    new Set(configured.map((m) => m.id)).size !== configured.length
  )
    throw Error('模型配置 ID 重复');
  return { revision: Number(v.revision), providers, models: configured };
}
export function modelWrite(value: unknown) {
  const v = models(value, true);
  return {
    revision: v.revision,
    providers: v.providers.map(({ has_api_key: _, ...p }) => p),
    models: v.models.map(({ reference: _, ...m }) => m),
  };
}
