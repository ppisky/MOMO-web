import { request as fetch } from '../../lib/transport';
import React, { useRef, useState } from 'react';
import { Badge, Box, Button, Flex, Group, NativeSelect, Radio, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Divider } from '../../ui/web/Divider';
import { ScalableIcon } from '../../ui/web/ScalableIcon';
import { record } from '../../contracts/core';
import { assetLabels, assets, directory, type Assets, type Disposition, type SpaceDirectory } from '../../contracts/spaces';

async function readResult(response: Response) {
  const value: unknown = await response.json();
  if (!response.ok) {
    const data = record(value);
    const code = typeof data.code === 'string' ? data.code : 'request_failed';
    const messages: Record<string, string> = {
      space_assets_changed: '资产已经变化，请重新查看并确认。',
      space_response_pending: '还有未完成的响应或记忆提交，请先处理后再删除。',
      space_migration_conflict: '目标空间存在资产冲突。原空间已保留，请选择其他空间，或创建一个新空间。',
      space_busy: '另一次资产操作尚未完成，请处理后再试。',
    };
    throw new Error(messages[code] ?? (typeof data.error === 'string' ? data.error : '无法完成操作，请重试'));
  }
  return value;
}

/** Independent React view. Transport endpoints are a development-host bridge;
 * the same contracts/host controller are intended for the target ron host. */
export function SpaceSettings({ initial }: { initial: SpaceDirectory }) {
  const [data, setData] = useState(initial);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Assets | null>(null);
  const [choice, setChoice] = useState<'migrate' | 'delete_assets' | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = async () => { const result = directory(await readResult(await fetch('/api/spaces', { cache: 'no-store' }))); setData(result); return result; };
  const command = async (body: Record<string, unknown>) => {
    const result = directory(await readResult(await fetch('/api/spaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: data.revision, ...body }) })));
    setData(result); return result;
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(null); setNotice(null);
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : '无法完成操作'); setInventory(null); setChoice(null); setTarget(''); await refresh().catch(() => {}); }
    finally { setBusy(false); }
  };
  const inspect = async (id: string) => {
    const generation = ++sequence.current;
    setInspecting(id); setInventory(null); setChoice(null); setTarget('');
    await run(async () => {
      const result = assets(await readResult(await fetch(`/api/spaces?inventory=${id}`, { cache: 'no-store' })));
      if (result.space_id !== id) throw new Error('资产与当前空间不一致');
      if (sequence.current === generation) setInventory(result);
    });
  };
  const remove = async () => {
    if (!inventory || !inspecting || !choice || choice === 'migrate' && !target) return;
    const disposition: Disposition = choice === 'migrate' ? { kind: 'migrate', target_id: target } : { kind: 'delete_assets' };
    await run(async () => {
      await command({ command: 'remove', id: inspecting, assetRevision: inventory.revision, disposition });
      setInspecting(null); setInventory(null); setNotice(choice === 'migrate' ? '资产已迁移，原空间已删除。' : '空间及其资产已删除。');
    });
  };
  const selected = data.spaces.find(space => space.id === inspecting);

  // Match Web settings pages: 16px content inset, 32px section gaps, h5 titles.
  return <Stack component="section" gap="xxl" p="md" aria-label="空间设置">
    <Stack gap="xs">
      <Title order={5}>空间</Title>
      <Text c="chatbox-tertiary">每个空间独立保存角色、对话、记忆和语义网。</Text>
    </Stack>
    {error && <Text c="chatbox-error" role="alert">{error}</Text>}
    {notice && <Text c="chatbox-success" role="status">{notice}</Text>}
    {data.pending && <Stack gap="xs" role="status">
      <Text fw={600}>上一次资产操作仍需核对</Text>
      <Text c="chatbox-tertiary">空间列表已保留。继续处理会核对同一次操作，不会重新创建迁移或删除。</Text>
      <Group><Button variant="outline" disabled={busy} onClick={() => void run(async () => { await command({ command: 'resume' }); setInspecting(null); setNotice('资产处理已核对，空间列表已更新。'); })}>{busy ? '正在核对…' : '继续核对并完成'}</Button></Group>
    </Stack>}
    <Box component="form" onSubmit={event => { event.preventDefault(); void run(async () => { await command({ command: 'create', name }); setName(''); setNotice('空间已创建。'); }); }}>
      <Flex gap="xs" className="space-create-fields">
        <TextInput id="new-space-name" label="新建空间" value={name} onChange={event => setName(event.currentTarget.value)} maxLength={60} placeholder="空间名称" disabled={busy || !!data.pending} required />
        <Button type="submit" variant="outline" leftSection={<ScalableIcon icon={IconPlus} size={16} />} disabled={busy || !!data.pending || !name.trim()}>创建</Button>
      </Flex>
    </Box>
    <Stack gap="xs">
      <Title order={5}>已有空间</Title>
      <Box aria-label="空间列表">{data.spaces.map(space => <Flex component="article" key={space.id} className="space-row" gap="sm" align="center" justify="space-between" wrap="wrap" aria-label={space.name}>
        {editing === space.id ? <Flex component="form" className="space-rename" gap="xs" align="center" wrap="wrap" onSubmit={event => { event.preventDefault(); void run(async () => { await command({ command: 'rename', id: space.id, name: editName }); setEditing(null); setNotice('名称已更新，资产归属未改变。'); }); }}>
          <TextInput aria-label="空间名称" value={editName} onChange={event => setEditName(event.currentTarget.value)} maxLength={60} required autoFocus disabled={busy} />
          <Button type="submit" variant="outline" disabled={busy}>保存</Button>
          <Button variant="subtle" color="chatbox-secondary" disabled={busy} onClick={() => setEditing(null)}>取消</Button>
        </Flex> : <Group gap="xs" className="space-row-name">
          <Text fw={600}>{space.name}</Text>
          {data.currentId === space.id && <Badge color="chatbox-brand" variant="light" size="sm" fw={400}>当前空间</Badge>}
        </Group>}
        {editing !== space.id && <Group gap="xxs" className="space-row-actions">
          <Button variant="subtle" disabled={busy || !!data.pending || space.id === data.currentId} onClick={() => void run(async () => { await command({ command: 'select', id: space.id }); })}>设为当前</Button>
          <Button variant="subtle" color="chatbox-secondary" disabled={busy || !!data.pending} onClick={() => { setEditing(space.id); setEditName(space.name); }}>重命名</Button>
          <Button variant="subtle" color="chatbox-error" disabled={busy || !!data.pending || data.spaces.length === 1} title={data.spaces.length === 1 ? '必须保留至少一个空间' : '先查看资产再确认删除'} onClick={() => void inspect(space.id)}>删除</Button>
        </Group>}
      </Flex>)}</Box>
      {data.spaces.length === 1 && <Text size="xs" c="chatbox-tertiary">至少保留一个空间，才能继续对话。</Text>}
    </Stack>
    {selected && !data.pending && <>
      <Divider />
      <Stack component="section" gap="md" aria-label={`删除${selected.name}`}>
        <Group justify="space-between"><Title order={5}>删除「{selected.name}」</Title><Button variant="subtle" color="chatbox-secondary" disabled={busy} onClick={() => { ++sequence.current; setInspecting(null); setInventory(null); }}>取消</Button></Group>
        {!inventory ? <Stack gap="xs">
          <Text c="chatbox-tertiary" role="status">{busy ? '正在读取实际资产…' : '未能读取资产，不能执行删除。'}</Text>
          <Group><Button variant="outline" disabled={busy} onClick={() => void inspect(selected.id)}>重新读取</Button></Group>
        </Stack> : <>
          <Text c="chatbox-tertiary">此空间包含以下资产，请选择如何处理。</Text>
          <Text component="dl" className="space-inventory">{Object.entries(assetLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{inventory[key as keyof typeof assetLabels]}</dd></div>)}</Text>
          {inventory.external_conversations > 0 && <Text size="xs" c="chatbox-tertiary">其他空间的对话会保留。删除资产会移除这些对话引用的角色；迁移会保持角色身份与引用。</Text>}
          <Radio.Group label="当前空间的资产如何处理？" name="space-disposition" value={choice ?? ''} onChange={value => setChoice(value as 'migrate' | 'delete_assets')}>
            <Stack gap="md" mt="xs">
              <Radio value="migrate" label="迁移后删除空间" description="保留资产身份、来源和注入范围。" disabled={busy} />
              {choice === 'migrate' && <NativeSelect label="迁移到" value={target} onChange={event => setTarget(event.currentTarget.value)} disabled={busy} data={[{ value: '', label: '选择另一个空间' }, ...data.spaces.filter(space => space.id !== selected.id).map(space => ({ value: space.id, label: space.name }))]} />}
              <Radio value="delete_assets" label="删除空间及其中资产" description="删除以上所属资产和待处理任务，无法通过“最近删除”恢复。其他空间拥有的记忆和语义网仍保留。" disabled={busy} />
            </Stack>
          </Radio.Group>
          <Group justify="space-between" mt="xs">
            <Button variant="subtle" color="chatbox-secondary" disabled={busy} onClick={() => void inspect(selected.id)}>刷新资产</Button>
            <Button variant="outline" color={choice === 'delete_assets' ? 'chatbox-error' : 'chatbox-brand'} disabled={busy || !choice || choice === 'migrate' && !target} onClick={() => void remove()}>{busy ? '正在处理资产…' : choice === 'delete_assets' ? '删除空间及资产' : '迁移资产并删除空间'}</Button>
          </Group>
        </>}
      </Stack>
    </>}
  </Stack>;
}
