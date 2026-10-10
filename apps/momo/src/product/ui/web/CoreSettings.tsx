import React from 'react';
import {
  Alert,
  Button,
  Flex,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { record, list, text } from '../../contracts/core';
import { parameters, purposeNames, modelsForPurpose, type ModelPurpose, type Parameters } from '../../contracts/parameters';
import { models, type Models } from '../../contracts/models';
import { parameterPolicy, enableParameterPolicy } from '../../contracts/parameter-policy';
import { useProduct } from './context';
import { api } from './api';
import { addToast } from './media';
import { useSettingsStore } from './store';
import { useTranslation } from 'react-i18next';
import { MemorySettings } from './MemorySettings';
import { RequestParameterJson } from './RequestParameterJson';
import { PurposeRequestJson } from './PurposeRequestJson';

export function useResource(kind: string) {
  const { data } = useProduct();
  const [value, setValue] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setValue(null);
    setError('');
    void api(`/api/resources?space=${data.spaceId}&kind=${kind}`, undefined, abort.signal)
      .then(setValue)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [kind, data.spaceId, version]);
  return { value, error, reload: () => setVersion((v) => v + 1) };
}
const promptNames: Record<string, string> = {
  assistant: '通用助手',
  vision_fallback: '视觉回退提示词',
  roleplay_director: '角色导演',
  memory_distillation: '记忆提取',
  semantic_graph_governance: '语义网维护',
  ddm_profile_generation: 'DDM 角色侧写',
};
export function PromptSettings() {
  const { data } = useProduct();
  const { value, error, reload } = useResource('prompts');
  const [selected, setSelected] = useState('assistant');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const entries = value
    ? list(value, (v) => {
        const p = record(v);
        return {
          id: text(p.id, 'id'),
          content: text(p.content, 'content'),
          source: text(p.source, 'source'),
        };
      })
    : [];
  const current = entries.find((p) => p.id === selected);
  useEffect(() => setContent(current?.content ?? ''), [current?.content, selected]);
  async function save(reset = false) {
    setBusy(true);
    try {
      await api('/api/resources', {
        spaceId: data.spaceId,
        command: reset ? 'prompt-reset' : 'prompt-save',
        id: selected,
        content,
      });
      reload();
      addToast(reset ? '已恢复内置提示词' : '提示词已保存');
    } catch (e) {
      addToast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap="md" maw={760}>
      <Title order={5}>提示词管理</Title>
      <Text size="sm" c="chatbox-secondary">
        按用途分别配置。通用助手提示词不覆盖角色对话的人物设定。
      </Text>
      {error ? (
        <Alert color="red">{error}</Alert>
      ) : (
        <>
          <Select
            label="提示词空间"
            value={selected}
            onChange={(v) => {
              if (v) setSelected(v);
            }}
            data={Object.entries(promptNames).map(([value, label]) => ({ value, label }))}
          />
          <Textarea
            aria-label="提示词内容"
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            autosize
            minRows={7}
            maxRows={20}
            disabled={!current}
          />
          <Flex justify="space-between" align="center">
            <Text size="xs" c="chatbox-tertiary">
              {current?.source === 'builtin' ? '使用内置提示词' : '已自定义'}
            </Text>
            <Flex gap="xs">
              <Button variant="subtle" disabled={!current || busy} onClick={() => void save(true)}>
                恢复默认
              </Button>
              <Button loading={busy} disabled={!current} onClick={() => void save()}>
                保存
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Stack>
  );
}
export function RuntimeSettings({ section = 'memory' }: { section?: 'memory' | 'history' }) {
  return section === 'memory' ? <MemorySettings /> : <RuntimeSection section="history" />;
}
function RuntimeSection({ section }: { section: 'memory' | 'history' }) {
  const { data } = useProduct();
  const { value, error, reload } = useResource('runtime');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, boolean | number> | null>(null);
  const [failure, setFailure] = useState('');
  const root = value ? record(value) : null;
  const settings = root ? record(root.settings) : null;
  const current = settings ? record(settings[section === 'history' ? 'history_window' : 'runtime']) : null;
  const defaults =
    section === 'history'
      ? { enabled: true, trigger_turns: 12, evict_turns: 2 }
      : {
          memory_distillation_enabled: true,
          memory_distill_every_turns: 12,
          semantic_graph_enabled: true,
          nsg_govern_every_turns: 12,
        };
  useEffect(() => {
    setDraft(null);
    setFailure('');
  }, [section, data.spaceId]);
  const fields = { ...defaults, ...current, ...draft };
  const update = (key: string, v: boolean | number) => setDraft((previous) => ({ ...previous, [key]: v }));
  async function save(reset = false) {
    if (!root) return;
    setBusy(true);
    setFailure('');
    try {
      const patch = reset ? Object.fromEntries(Object.keys(defaults).map((key) => [key, null])) : draft;
      await api('/api/resources', {
        spaceId: data.spaceId,
        command: 'runtime-save',
        revision: root.revision,
        patch: { [section === 'history' ? 'history_window' : 'runtime']: patch },
      });
      setDraft(null);
      reload();
      addToast(reset ? '已恢复继承默认策略' : '当前个人空间策略已保存');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  if (error) return <Alert color="red">{error}</Alert>;
  return (
    <Stack gap="md" maw={680}>
      <Title order={5}>{section === 'history' ? '上下文管理' : '记忆与语义网'}</Title>
      {failure && <Alert color="red">{failure}</Alert>}
      {section === 'history' ? (
        <>
          <Switch
            label="历史窗口管理"
            description="按对话轮数控制历史窗口。"
            checked={fields.enabled === true}
            disabled={!current || busy}
            onChange={(e) => update('enabled', e.currentTarget.checked)}
          />
          <NumberInput
            label="触发轮数"
            min={2}
            max={1000}
            value={Number(fields.trigger_turns)}
            disabled={!current || busy}
            onChange={(v) => {
              if (typeof v === 'number') update('trigger_turns', v);
            }}
          />
          <NumberInput
            label="每次移出轮数"
            min={1}
            max={Math.max(1, Number(fields.trigger_turns) - 1)}
            value={Number(fields.evict_turns)}
            disabled={!current || busy}
            onChange={(v) => {
              if (typeof v === 'number') update('evict_turns', v);
            }}
          />
          <Text size="xs" c="chatbox-tertiary">
            原版的摘要压缩和压缩提示词尚未接入；历史窗口按轮数工作。
          </Text>
        </>
      ) : (
        <>
          <Switch
            label="自动提取记忆"
            checked={fields.memory_distillation_enabled === true}
            disabled={!current || busy}
            onChange={(e) => update('memory_distillation_enabled', e.currentTarget.checked)}
          />
          <NumberInput
            label="记忆提取间隔（轮）"
            min={1}
            max={200}
            value={Number(fields.memory_distill_every_turns)}
            disabled={!current || busy}
            onChange={(v) => {
              if (typeof v === 'number') update('memory_distill_every_turns', v);
            }}
          />
          <Switch
            label="维护语义网"
            checked={fields.semantic_graph_enabled === true}
            disabled={!current || busy}
            onChange={(e) => update('semantic_graph_enabled', e.currentTarget.checked)}
          />
          <NumberInput
            label="语义网维护间隔（轮）"
            min={1}
            max={200}
            value={Number(fields.nsg_govern_every_turns)}
            disabled={!current || busy}
            onChange={(v) => {
              if (typeof v === 'number') update('nsg_govern_every_turns', v);
            }}
          />
          <Text size="xs" c="chatbox-tertiary">
            仅调整当前个人空间。关闭自动提取不会删除已有资产。
          </Text>
        </>
      )}
      <Flex justify="flex-end" gap="xs">
        <Button variant="subtle" disabled={!current || busy} onClick={() => void save(true)}>
          恢复继承
        </Button>
        <Button disabled={!draft || !current} loading={busy} onClick={() => void save()}>
          保存
        </Button>
      </Flex>
    </Stack>
  );
}
function ModelParameterPolicy({ extraNames }: { extraNames: string[] }) {
  const { data } = useProduct();
  const { value, error, reload } = useResource('runtime');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  useEffect(() => setFailure(''), [data.spaceId]);
  let policy: ReturnType<typeof parameterPolicy> | null = null;
  let invalid = '';
  try {
    if (value) {
      const parsed = parameterPolicy(value);
      if (parsed.spaceId === data.spaceId) policy = parsed;
    }
  } catch (e) { invalid = e instanceof Error ? e.message : '无法读取空间策略'; }
  async function enable() {
    if (!policy) return;
    const selectedSpace = policy.spaceId;
    setBusy(true);
    setFailure('');
    try {
      await api('/api/resources', {
        spaceId: selectedSpace, command: 'runtime-save', revision: policy.revision,
        patch: enableParameterPolicy(policy, extraNames),
      });
      window.dispatchEvent(new Event('momo-parameter-policy-changed'));
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '策略更新失败');
      reload();
    } finally { setBusy(false); }
  }
  if (error || invalid) return <Alert color="red">{error || invalid}</Alert>;
  if (!policy) return <Text size="xs" c="dimmed">正在读取当前个人空间的参数策略…</Text>;
  const accepts = policy.sampling === 'allow' && policy.maxOutput === 'allow' && ['top_p', ...extraNames].every((key) => policy.allowedParameters.includes(key));
  return (
    <Stack gap="xs">
      {failure && <Alert color="red">{failure}</Alert>}
      {accepts ? <Text size="xs" c="dimmed">当前个人空间允许使用模型参数；保存参数组不会更改空间策略。</Text> : (
        <Alert color="yellow" title="当前个人空间限制了部分模型参数">
          <Stack gap="xs">
            <Text size="sm">参数组可以保存。启用后，当前个人空间允许温度、Top P、最大输出{extraNames.length ? `及 JSON 参数：${extraNames.join('、')}` : ''}。</Text>
            <Button size="xs" variant="light" loading={busy} onClick={() => void enable()} style={{ alignSelf: 'flex-start' }}>
              允许当前个人空间使用模型参数
            </Button>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}

export function ModelParameters() {
  const { t } = useTranslation();
  const { data, openSettings } = useProduct();
  const [catalog, setCatalog] = useState<Models | null>(null);
  const [config, setConfig] = useState<Parameters | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const settings = useSettingsStore((s) => s);
  const [jsonError, setJsonError] = useState('');
  const [purposeErrors, setPurposeErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    void api('/api/models')
      .then((v) => setCatalog(models(v)))
      .catch((e) => setError(e.message));
    void api('/api/parameters')
      .then((v) => setConfig(parameters(v)))
      .catch((e) => setError(e.message));
  }, []);
  const current = config?.groups.find((g) => g.id === config.selectedId);
  function patch(value: Record<string, unknown>) {
    if (config && current)
      setConfig({
        ...config,
        groups: config.groups.map((g) => (g.id === current.id ? { ...g, ...value } : g)),
      });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      setConfig(parameters(await api('/api/parameters', { ...config, spaceId: data.spaceId })));
      window.dispatchEvent(new Event('momo-models-changed'));
      addToast('模型配置已保存，后续请求按所在空间策略应用');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack p="md" gap="lg" maw={680}>
      <Title order={5}>{t('Model Parameters')}</Title>
      <Text size="sm" c="chatbox-secondary">
        参数配置用于后续请求，角色和对话不保存参数副本。留空跟随模型默认值。
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      <ModelParameterPolicy key={data.spaceId} extraNames={[...new Set([
        ...(config?.groups.flatMap((g) => Object.keys(g.parameters ?? {})) ?? []),
        ...Object.values(config?.purposeParameters ?? {}).flatMap((p) => Object.keys(p ?? {}).filter((key) => !['temperature', 'max_output_tokens'].includes(key))),
      ])]} />
      {config && current && (
        <>
          <Flex gap="xs" align="flex-end">
            <Select
              flex={1}
              label="参数组"
              value={current.id}
              data={config.groups.map((g) => ({ value: g.id, label: g.name }))}
              onChange={(v) => {
                if (v) setConfig({ ...config, selectedId: v });
              }}
            />
            <Button
              variant="light"
              onClick={() => {
                const id = crypto.randomUUID();
                setConfig({
                  ...config,
                  selectedId: id,
                  groups: [
                    ...config.groups,
                    { id, name: '新参数组', temperature: null, topP: null, maxOutput: null },
                  ],
                });
              }}
            >
              新建
            </Button>
          </Flex>
          <TextInput
            label="名称"
            value={current.name}
            onChange={(e) => patch({ name: e.currentTarget.value })}
          />
          <Select
            label="对话模型"
            searchable
            allowDeselect={false}
            value={current.modelId ?? null}
            placeholder="请选择对话或多模态模型"
            nothingFoundMessage="请先在服务商中添加模型"
            data={[
              ...(catalog?.models
                .filter((m) => m.kind !== 'embedding')
                .map((m) => ({
                  value: m.id,
                  label: `${m.name} · ${catalog.providers.find((p) => p.id === m.provider_id)?.name ?? ''}`,
                })) ?? []),
            ]}
            onChange={(id) => patch({ modelId: id })}
          />
          <Button
            variant="subtle"
            size="xs"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => openSettings('provider')}
          >
            管理服务商与模型
          </Button>
          <NumberInput
            label={t('Temperature')}
            description={t(
              'Higher values make replies more varied. Leave empty to follow the model default.',
            )}
            min={0}
            max={2}
            step={0.1}
            decimalScale={2}
            value={current.temperature ?? ''}
            placeholder={t('Not set')}
            onChange={(v) => patch({ temperature: typeof v === 'number' ? v : null })}
          />
          <NumberInput
            label="Top P"
            description={t('Sampling probability threshold. Leave empty to follow the model default.')}
            min={0}
            max={1}
            step={0.05}
            decimalScale={2}
            value={current.topP ?? ''}
            placeholder={t('Not set')}
            onChange={(v) => patch({ topP: typeof v === 'number' ? v : null })}
          />
          <NumberInput
            label={t('Max Output Tokens')}
            description="留空跟随模型；填写时必须为正整数。"
            min={1}
            allowDecimal={false}
            value={current.maxOutput ?? ''}
            placeholder={t('Not set')}
            onChange={(v) => patch({ maxOutput: typeof v === 'number' ? v : null })}
          />
          <Switch
            label={t('Stream output')}
            description={t('Show the reply as it is generated.')}
            checked={settings.stream}
            onChange={(e) => settings.setSettings({ stream: e.currentTarget.checked })}
          />
          <RequestParameterJson
            key={current.id}
            group={current}
            stream={settings.stream}
            onStreamChange={(stream) => settings.setSettings({ stream })}
            onChange={(value) => patch(value)}
            onError={setJsonError}
          />
          {!!catalog?.models.length && <>
            <Title order={6}>功能模型</Title>
            <Text size="sm" c="dimmed">
              按模型类型选择用途；未单独指定时跟随对话模型。对话请求参数仅用于对话。
            </Text>
          </>}
          {(Object.entries(purposeNames) as [ModelPurpose, string][])
            .filter(([purpose]) => modelsForPurpose(catalog, purpose).length > 0)
            .map(([purpose, label]) => (
              <React.Fragment key={purpose}>
              <Select
                label={label}
                allowDeselect={false}
                value={
                  config.purposes?.[purpose] ??
                  (purpose !== 'vision' || catalog?.models.some((m) => m.id === current.modelId && m.kind === 'vision')
                    ? 'follow'
                    : null)
                }
                placeholder="请选择视觉回退模型"
                searchable
                clearable={purpose === 'vision'}
                data={[
                  ...(purpose !== 'vision' ||
                  catalog?.models.some((m) => m.id === current.modelId && m.kind === 'vision')
                    ? [{ value: 'follow', label: '跟随对话' }]
                    : []),
                  ...(modelsForPurpose(catalog, purpose).map((m) => ({
                    value: m.id,
                    label: `${m.name} · ${catalog?.providers.find((p) => p.id === m.provider_id)?.name ?? ''}`,
                  })) ?? []),
                ]}
                onChange={(id) =>
                  setConfig({
                    ...config,
                    purposes: { ...config.purposes, [purpose]: id === 'follow' ? null : id },
                  })
                }
              />
              <PurposeRequestJson
                key={`${purpose}-${config.purposes?.[purpose] ?? current.modelId}-${data.spaceId}`}
                purpose={purpose} label={label} spaceId={data.spaceId}
                modelId={modelsForPurpose(catalog, purpose).find((m) => m.id === (config.purposes?.[purpose] ?? current.modelId))?.id ?? null}
                value={config.purposeParameters?.[purpose]}
                onChange={(value) => {
                  const custom = { ...config.purposeParameters };
                  if (Object.keys(value).length) custom[purpose] = value; else delete custom[purpose];
                  setConfig({ ...config, purposeParameters: custom });
                }}
                onError={(message) => setPurposeErrors((previous) => previous[purpose] === message ? previous : { ...previous, [purpose]: message })}
              />
              </React.Fragment>
            ))}
          {catalog && modelsForPurpose(catalog, 'embedding').length > 0 && (
            <>
              <Select
                label="语义网向量化模型"
                description="用于语义网索引与相似度检索，独立于语义网整理模型。"
                searchable
                clearable
                value={config.embedding?.modelId ?? null}
                placeholder="不使用向量化"
                data={modelsForPurpose(catalog, 'embedding').map((m) => ({
                  value: m.id,
                  label: `${m.name} · ${catalog.providers.find((p) => p.id === m.provider_id)?.name ?? ''}`,
                  disabled: !catalog.providers.some(
                    (p) => p.id === m.provider_id && ['openai', 'openai_responses'].includes(p.protocol)
                  ),
                }))}
                onChange={(id) =>
                  setConfig({
                    ...config,
                    embedding: id
                      ? { ...config.embedding, modelId: id, dimension: config.embedding?.modelId === id ? config.embedding.dimension : null }
                      : null,
                  })
                }
              />
              {config.embedding && (
                <NumberInput
                  label="向量维数"
                  description="填写该模型的实际输出维数，Core 用于校验和区分索引；不修改模型的输出维数。"
                  min={1}
                  max={8192}
                  allowDecimal={false}
                  value={config.embedding.dimension ?? ''}
                  onChange={(value) => {
                    if (config.embedding)
                      setConfig({
                        ...config,
                        embedding: { ...config.embedding, dimension: typeof value === 'number' ? value : null },
                      })
                  }}
                />
              )}
              <PurposeRequestJson key={`embedding-${config.embedding?.modelId}-${data.spaceId}`}
                purpose="embedding" label="语义网向量化" spaceId={data.spaceId}
                modelId={config.embedding?.modelId ?? null} dimension={config.embedding?.dimension}
                value={config.embedding?.parameters}
                onChange={(value) => {
                  if (config.embedding) { const { parameters: _old, ...selection } = config.embedding;
                    setConfig({ ...config, embedding: { ...selection, ...(Object.keys(value).length ? { parameters: value } : {}) } });
                  }
                }}
                onError={(message) => setPurposeErrors((previous) => previous.embedding === message ? previous : { ...previous, embedding: message })}
              />
            </>
          )}
          <Flex justify="flex-end">
            <Button
              color="red"
              variant="subtle"
              disabled={config.groups.length === 1}
              onClick={() => {
                const groups = config.groups.filter((g) => g.id !== current.id)
                setConfig({ ...config, groups, selectedId: groups[0]!.id })
              }}
            >
              删除参数组
            </Button>
            <Button loading={busy} disabled={!!jsonError || Object.values(purposeErrors).some(Boolean)} onClick={() => void save()}>
              {t('Save')}
            </Button>
          </Flex>
        </>
      )}
    </Stack>
  )
}
