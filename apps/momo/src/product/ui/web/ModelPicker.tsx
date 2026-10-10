import React, { useEffect, useState } from 'react';
import { Alert, Button, Popover, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { models, type Models } from '../../contracts/models';
import { parameters, type Parameters } from '../../contracts/parameters';
import { useProduct } from './context';
import { api } from './api';
export function ModelPicker() {
  const { data, openSettings } = useProduct();
  const [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [catalog, setCatalog] = useState<Models | null>(null),
    [config, setConfig] = useState<Parameters | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const load = () => {
      void Promise.all([
        api('/api/models', undefined, abort.signal),
        api('/api/parameters', undefined, abort.signal),
      ])
        .then(([m, p]) => {
          setCatalog(models(m));
          setConfig(parameters(p));
          setError('');
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        });
    };
    load();
    window.addEventListener('momo-models-changed', load);
    return () => {
      abort.abort();
      window.removeEventListener('momo-models-changed', load);
    };
  }, []);
  const group = config?.groups.find((g) => g.id === config.selectedId);
  const model = catalog?.models.find((m) => m.id === group?.modelId);
  async function save(next: Parameters) {
    setBusy(true);
    setError('');
    try {
      setConfig(parameters(await api('/api/parameters', { ...next, spaceId: data.spaceId })));
      window.dispatchEvent(new Event('momo-models-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '选择失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Popover opened={opened} onChange={setOpened} width={300} position="top-end" withinPortal>
      <Popover.Target>
        <UnstyledButton
          aria-label="选择模型"
          className="flex items-center gap-1 min-w-0 rounded-lg px-2 py-1 hover:bg-chatbox-background-tertiary"
          onClick={() => setOpened((v) => !v)}
        >
          <Text size="sm" c="chatbox-secondary" truncate maw={200}>
            {model?.name ?? (group?.modelId ? '模型不可用' : '请选择对话或多模态模型')}
          </Text>
          <IconChevronDown size={14} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          {config && group && (
            <>
              <Select
                label="参数组"
                allowDeselect={false}
                disabled={busy}
                value={group.id}
                data={config.groups.map((g) => ({ value: g.id, label: g.name }))}
                onChange={(id) => {
                  if (id) void save({ ...config, selectedId: id });
                }}
              />
              <Select
                label="模型"
                searchable
                allowDeselect={false}
                disabled={busy}
                value={group.modelId ?? null}
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
                onChange={(id) => {
                  if (id)
                    void save({
                      ...config,
                      groups: config.groups.map((g) => (g.id === group.id ? { ...g, modelId: id } : g)),
                    });
                }}
              />
            </>
          )}
          <Button
            variant="subtle"
            size="xs"
            onClick={() => {
              setOpened(false);
              openSettings('provider');
            }}
          >
            管理模型
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
