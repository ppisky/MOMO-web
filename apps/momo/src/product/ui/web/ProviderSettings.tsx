// Adapted from MOMO-web provider/$providerId.tsx and ProviderList.tsx (GPL-3.0).
import React, { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Flex,
  Modal,
  NumberInput,
  PasswordInput,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconEdit, IconPlus, IconServer, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  models,
  protocols,
  modelKinds,
  type Models,
  type Provider,
  type Model,
} from '../../contracts/models';
import { api } from './api';
import { addToast } from './media';
import { useIsSmallScreen } from './store';

export function ProviderSettings() {
  const { t } = useTranslation();
  const small = useIsSmallScreen();
  const [config, setConfig] = useState<Models | null>(null),
    [selected, setSelected] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<Model | null>(null),
    [removing, setRemoving] = useState<Provider | Model | null>(null);
  const [fetched, setFetched] = useState<{ model_id: string; name: string }[] | null>(null),
    [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void api('/api/models', undefined, abort.signal)
      .then((v) => {
        const c = models(v);
        setConfig(c);
        setSelected(c.providers[0]?.id ?? '');
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, []);
  const provider = config?.providers.find((p) => p.id === selected);
  const ownModels = config?.models.filter((m) => m.provider_id === selected) ?? [];
  function update(next: Models) {
    setConfig(next);
    setDirty(true);
    setError('');
  }
  function patch(value: Partial<Provider>) {
    if (config && provider)
      update({
        ...config,
        providers: config.providers.map((p) => (p.id === provider.id ? { ...p, ...value } : p)),
      });
  }
  async function save(next = config) {
    if (!next) return false;
    setBusy(true);
    setError('');
    try {
      models(next, true);
      const saved = models(await api('/api/models', next));
      setConfig(saved);
      setDirty(false);
      window.dispatchEvent(new Event('momo-models-changed'));
      addToast('模型配置已保存');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
      return false;
    } finally {
      setBusy(false);
    }
  }
  function addProvider() {
    if (!config) return;
    const id = crypto.randomUUID();
    update({
      ...config,
      providers: [
        ...config.providers,
        {
          id,
          name: '自定义服务商',
          protocol: 'openai',
          base_url: 'https://api.openai.com/v1',
          api_path: '',
          has_api_key: false,
        },
      ],
    });
    setSelected(id);
  }
  function newModel(model_id = '', name = '') {
    setEditing({
      id: crypto.randomUUID(),
      provider_id: selected,
      model_id,
      name,
      kind: 'chat',
      context_window: null,
      max_output_tokens: null,
    });
  }
  async function discover() {
    if (!provider || (dirty && !(await save()))) return;
    setBusy(true);
    setError('');
    try {
      const raw = (await api('/api/models', { command: 'discover', providerId: provider.id })) as {
        models: { model_id: string; name: string }[];
        has_more: boolean;
      };
      setFetched(raw.models);
      setHasMore(raw.has_more);
    } catch {
      setError('无法获取模型，请检查服务地址，或手动添加模型 ID。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Flex h="100%" direction={small ? 'column' : 'row'}>
      <Stack
        w={small ? '100%' : 224}
        miw={small ? undefined : 180}
        gap={0}
        className={small ? '' : 'border-0 border-r border-solid border-chatbox-border-primary'}
        style={{ flexShrink: 0 }}
      >
        <ScrollArea flex={1} mah={small ? 180 : undefined}>
          <Stack p="xs" gap="xs">
            {!config?.providers.length && (
              <Text size="sm" c="dimmed" p="md">
                {t('No custom providers')}
              </Text>
            )}
            {config?.providers.map((p) => (
              <UnstyledButton key={p.id} aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}>
                <Flex
                  gap="sm"
                  align="center"
                  p="sm"
                  className="rounded-lg"
                  bg={selected === p.id ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
                  c="chatbox-secondary"
                >
                  <IconServer size={28} style={{ flexShrink: 0 }} />
                  <Text size="sm" truncate>
                    {p.name}
                  </Text>
                </Flex>
              </UnstyledButton>
            ))}
          </Stack>
        </ScrollArea>
        <Button
          m="md"
          variant="outline"
          leftSection={<IconPlus size={16} />}
          disabled={!config || busy}
          onClick={addProvider}
        >
          {t('Add Custom Provider')}
        </Button>
      </Stack>
      <ScrollArea flex={1} miw={0}>
        <Stack p="md" gap="lg" maw={760}>
          {error && <Alert color="red">{error}</Alert>}
          {provider && config ? (
            <>
              <Title order={4}>{provider.name || t('Custom Provider')}</Title>
              <TextInput
                label={t('Name')}
                value={provider.name}
                onChange={(e) => patch({ name: e.currentTarget.value })}
              />
              <Select
                label={t('API protocol')}
                value={provider.protocol}
                allowDeselect={false}
                data={[...protocols]}
                onChange={(v) => {
                  if (protocols.some((p) => p.value === v)) patch({ protocol: v as Provider['protocol'] });
                }}
              />
              <TextInput
                label={t('API endpoint')}
                placeholder="http(s)://…"
                value={provider.base_url}
                onChange={(e) => patch({ base_url: e.currentTarget.value })}
              />
              <TextInput
                label={t('API Path')}
                description={t('Leave empty to use the standard path for this API protocol.')}
                placeholder={t('optional')}
                value={provider.api_path}
                onChange={(e) => patch({ api_path: e.currentTarget.value })}
              />
              <PasswordInput
                label={t('API Key')}
                description={
                  provider.has_api_key
                    ? '已保存密钥。留空保持现有密钥，输入新值后保存可替换。'
                    : t('Optional for local services without authentication.')
                }
                placeholder={provider.has_api_key ? '已配置' : ''}
                value={provider.api_key ?? ''}
                onChange={(e) => patch({ api_key: e.currentTarget.value || undefined })}
              />
              {provider.has_api_key && (
                <Checkbox
                  label="清除已保存的 API Key"
                  checked={provider.api_key === ''}
                  onChange={(e) => patch({ api_key: e.currentTarget.checked ? '' : undefined })}
                />
              )}
              <Flex align="center" justify="space-between">
                <Text fw={600}>{t('Models')}</Text>
                <Flex gap="xs">
                  <Button size="xs" variant="light" onClick={() => newModel()}>
                    {t('Add model')}
                  </Button>
                  <Button size="xs" variant="default" loading={busy} onClick={() => void discover()}>
                    {t('Fetch')}
                  </Button>
                </Flex>
              </Flex>
              {!ownModels.length && (
                <Text size="sm" c="dimmed">
                  {t('No models configured. Enter the model IDs provided by your service.')}
                </Text>
              )}
              <Stack gap={0}>
                {ownModels.map((m) => (
                  <Flex
                    key={m.id}
                    py="sm"
                    align="center"
                    gap="sm"
                    className="border-0 border-b border-solid border-chatbox-border-primary"
                  >
                    <Stack gap={2} flex={1} miw={0}>
                      <Text size="sm" truncate>
                        {m.name}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {m.model_id}
                      </Text>
                    </Stack>
                    <Badge variant="light" color="gray">
                      {modelKinds.find((k) => k.value === m.kind)?.label}
                    </Badge>
                    <ActionIcon
                      aria-label={`编辑 ${m.name}`}
                      variant="subtle"
                      onClick={() => setEditing({ ...m })}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      aria-label={`删除 ${m.name}`}
                      variant="subtle"
                      color="red"
                      onClick={() => setRemoving(m)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Flex>
                ))}
              </Stack>
              <Flex justify="space-between">
                <Button color="red" variant="subtle" size="xs" onClick={() => setRemoving(provider)}>
                  {t('Delete custom provider?')}
                </Button>
                <Button loading={busy} disabled={!dirty} onClick={() => void save()}>
                  {t('Save')}
                </Button>
              </Flex>
            </>
          ) : (
            <Stack p="md">
              <Title order={5}>{t('Service Providers')}</Title>
              <Text c="dimmed" size="sm">
                {t('Add a custom provider to configure your endpoint, API key and model IDs.')}
              </Text>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={t('Add model')} centered>
        {editing && config && (
          <Stack>
            <TextInput
              label="模型 ID"
              value={editing.model_id}
              onChange={(e) => setEditing({ ...editing, model_id: e.currentTarget.value })}
            />
            <TextInput
              label={t('Name')}
              placeholder="默认使用模型 ID"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.currentTarget.value })}
            />
            <Select
              label="模型类型"
              allowDeselect={false}
              data={[...modelKinds]}
              value={editing.kind}
              onChange={(v) => {
                if (v) setEditing({ ...editing, kind: v as Model['kind'] });
              }}
            />
            <NumberInput
              label="上下文长度"
              description="可留空，表示未声明。填写时必须为正整数，不能为 0。"
              min={1024}
              max={16000000}
              allowDecimal={false}
              value={editing.context_window ?? ''}
              placeholder="未设置"
              onChange={(v) => setEditing({ ...editing, context_window: typeof v === 'number' ? v : null })}
            />
            <NumberInput
              label="模型输出上限"
              description="留空由 Core 使用默认预算。对话中的最大输出在参数组里设置。"
              min={1}
              allowDecimal={false}
              value={editing.max_output_tokens ?? ''}
              onChange={(v) =>
                setEditing({ ...editing, max_output_tokens: typeof v === 'number' ? v : null })
              }
            />
            <Button
              onClick={() => {
                try {
                  const model = { ...editing, name: editing.name.trim() || editing.model_id.trim() };
                  if (
                    config.models.some(
                      (m) =>
                        m.id !== model.id &&
                        m.provider_id === model.provider_id &&
                        m.model_id === model.model_id,
                    )
                  )
                    throw Error('此模型 ID 已存在');
                  const next = {
                    ...config,
                    models: [...config.models.filter((m) => m.id !== model.id), model],
                  };
                  models(next, true);
                  update(next);
                  setEditing(null);
                } catch (e) {
                  addToast(e instanceof Error ? e.message : '模型配置无效');
                }
              }}
            >
              {t('Save')}
            </Button>
          </Stack>
        )}
      </Modal>
      <Modal opened={!!removing} onClose={() => setRemoving(null)} title="确认删除" centered>
        <Stack>
          <Text>
            删除“{removing?.name}”{removing && !('model_id' in removing) ? '及其模型' : ''}
            ？已有对话和参数组会保留；正在使用的模型需要先更换。
          </Text>
          <Flex justify="flex-end">
            <Button variant="default" onClick={() => setRemoving(null)}>
              取消
            </Button>
            <Button
              color="red"
              loading={busy}
              onClick={async () => {
                if (!config || !removing) return;
                const next =
                  'model_id' in removing
                    ? { ...config, models: config.models.filter((m) => m.id !== removing.id) }
                    : {
                        ...config,
                        providers: config.providers.filter((p) => p.id !== removing.id),
                        models: config.models.filter((m) => m.provider_id !== removing.id),
                      };
                if (await save(next)) {
                  if (selected === removing.id) setSelected(next.providers[0]?.id ?? '');
                  setRemoving(null);
                }
              }}
            >
              删除
            </Button>
          </Flex>
        </Stack>
      </Modal>
      <Modal opened={fetched !== null} onClose={() => setFetched(null)} title={t('Models')} centered>
        <Stack>
          {hasMore && (
            <Text size="sm" c="dimmed">
              服务商还有更多模型，可按 ID 手动添加。
            </Text>
          )}
          {fetched?.map((m) => (
            <Flex key={m.model_id} align="center" gap="sm">
              <Text size="sm" flex={1}>
                {m.name}
              </Text>
              <Button
                size="xs"
                variant="light"
                disabled={ownModels.some((o) => o.model_id === m.model_id)}
                onClick={() => {
                  setFetched(null);
                  newModel(m.model_id, m.name);
                }}
              >
                添加
              </Button>
            </Flex>
          ))}
          {!fetched?.length && <Text c="dimmed">未获取到模型，可以手动添加。</Text>}
        </Stack>
      </Modal>
    </Flex>
  );
}
