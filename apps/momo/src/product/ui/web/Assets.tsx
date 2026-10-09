import React from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { list, record, text } from '../../contracts/core';
import { useResource } from './CoreSettings';
import { useProduct } from './context';
import { api } from './api';
import Page from './Page';
import { AssetEditor } from './AssetEditor';
type Asset = {
  id: string;
  title: string;
  scope: string;
  origin: string;
  status: string;
  body: string;
  edges: string[];
};
export function Assets({ graph = false }: { graph?: boolean }) {
  const { data } = useProduct();
  const { value, error, reload } = useResource(graph ? 'nsg' : 'memory');
  const provenance = useResource(graph ? 'provenance&graph=true' : 'provenance');
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>('all');
  const [scope, setScope] = useState<string | null>('all');
  const [origin, setOrigin] = useState<string | null>('all');
  const [body, setBody] = useState('');
  useEffect(() => {
    setSelected(null);
    setEditing(null);
    setBody('');
  }, [data.spaceId, graph]);
  const ledger = provenance.value ? record(record(provenance.value).ledger) : null;
  const records = ledger ? record(ledger.records) : {};
  const rows = value ? list(value, record) : [];
  const assets: Asset[] = value
    ? list(value, (raw) => {
        const a = record(raw);
        const id = text(a.id, 'id');
        const entry = records[id] ? record(records[id]) : null;
        const revisions = entry && Array.isArray(entry.revisions) ? entry.revisions : [];
        const latest = revisions.length ? record(record(revisions[0]).context) : null;
        const origin =
          latest?.proposer === 'local_author'
            ? 'user'
            : ['dmw_distiller', 'nsg_governor'].includes(String(latest?.proposer))
            ? 'automatic'
            : 'unknown';
        const aliases = Array.isArray(a.aliases)
          ? a.aliases.filter((v): v is string => typeof v === 'string')
          : [];
        return {
          id,
          title:
            aliases[0] ?? (graph && Array.isArray(a.anchors) ? String(a.anchors[0] ?? id) : id),
          scope:
            typeof a.injection_scope === 'string'
              ? a.injection_scope
              : graph && Array.isArray(a.inject_character_ids) && a.inject_character_ids.length
              ? 'character'
              : 'unspecified',
          origin,
          status: String(a.status ?? ''),
          body: graph
            ? [
                ['触发', a.trigger],
                ['条件', a.condition],
                ['约束', a.constraint],
                ['结果', a.consequence],
              ]
                .map(([k, v]) => `**${k}**\n\n${String(v ?? '')}`)
                .join('\n\n')
            : '',
          edges: Array.isArray(a.edges)
            ? a.edges.flatMap((e) => {
                if (!e || typeof e !== 'object') return [];
                const v = record(e);
                return typeof v.target === 'string'
                  ? [v.target]
                  : typeof v.to === 'string'
                  ? [v.to]
                  : [];
              })
            : [],
        };
      })
    : [];
  const visible = assets.filter(
    (a) =>
      (a.title + ' ' + a.body).toLowerCase().includes(query.toLowerCase()) &&
      (scope === 'all' || a.scope === scope) &&
      (origin === 'all' || a.origin === origin)
  );
  const current = assets.find((a) => a.id === selected);
  const currentHistory = selected && records[selected] ? record(records[selected]) : null;
  const currentPolicy = currentHistory?.policy ? record(currentHistory.policy) : null;
  useEffect(() => {
    setBody('');
    if (!graph && selected) {
      const abort = new AbortController();
      void api(
        `/api/resources?space=${data.spaceId}&kind=memory-content&id=${encodeURIComponent(
          selected
        )}`,
        undefined,
        abort.signal
      )
        .then((v) => setBody(text(record(v).body, 'body')))
        .catch((e) => {
          if (!abort.signal.aborted) setBody(e.message);
        });
      return () => abort.abort();
    }
  }, [selected, data.spaceId, graph]);
  return (
    <Page
      title={graph ? '语义网' : '记忆'}
      right={
        <Flex gap="xs">
          <Button
            variant="subtle"
            size="xs"
            onClick={() => {
              reload();
              provenance.reload();
            }}
          >
            刷新
          </Button>
          <Button size="xs" onClick={() => setEditing('new')}>
            {graph ? '新建节点' : '新建记忆'}
          </Button>
        </Flex>
      }
    >
      <Stack p="md" gap="md" h="100%">
        <Flex gap="sm" wrap="wrap">
          <TextInput
            flex={1}
            miw={180}
            aria-label="搜索资产"
            placeholder={graph ? '搜索节点' : '搜索记忆'}
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Select
            aria-label="注入范围"
            value={scope}
            onChange={setScope}
            data={[
              { value: 'all', label: '全部注入范围' },
              ...(!graph ? [{ value: 'conversation', label: '单个对话' }] : []),
              { value: 'character', label: graph ? '指定角色（受世界范围限制）' : '角色范围' },
              ...(!graph ? [{ value: 'account', label: '空间范围' }] : []),
              { value: 'unspecified', label: '未指定范围' },
            ]}
          />
          <Select
            aria-label="来源"
            value={origin}
            onChange={setOrigin}
            data={[
              { value: 'all', label: '全部来源' },
              { value: 'user', label: '用户创建' },
              { value: 'automatic', label: '自动产生' },
              { value: 'unknown', label: '来源待核对' },
            ]}
          />
          <Select
            aria-label="资产状态"
            value={status}
            onChange={setStatus}
            data={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '启用' },
              { value: 'archived', label: '已归档' },
            ]}
          />
        </Flex>
        {error && <Alert color="red">{error}</Alert>}
        <Flex flex={1} gap="lg" className="min-h-0" direction={{ base: 'column', sm: 'row' }}>
          <Box flex={1} className="overflow-auto">
            {graph && visible.length > 0 ? (
              <Box
                className="nsg-canvas rounded-lg"
                style={{ minHeight: 360, background: 'var(--chatbox-background-secondary)' }}
              >
                <svg
                  role="group"
                  aria-label="语义网节点关系"
                  viewBox="0 0 800 460"
                  width="100%"
                  style={{ minHeight: 340 }}
                >
                  <defs>
                    <marker
                      id="nsg-arrow"
                      viewBox="0 0 10 10"
                      refX="35"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--chatbox-border-brand)" />
                    </marker>
                  </defs>
                  {visible.map((node, i) => {
                    const angle = (i * Math.PI * 2) / visible.length;
                    const x = 400 + (visible.length === 1 ? 0 : 240 * Math.cos(angle));
                    const y = 230 + (visible.length === 1 ? 0 : 140 * Math.sin(angle));
                    return (
                      <g key={node.id}>
                        {node.edges.map((target) => {
                          const j = visible.findIndex((v) => v.id === target);
                          if (j < 0) return null;
                          return (
                            <line
                              key={target}
                              x1={x}
                              y1={y}
                              x2={400 + 240 * Math.cos((j * Math.PI * 2) / visible.length)}
                              y2={230 + 140 * Math.sin((j * Math.PI * 2) / visible.length)}
                              stroke="var(--chatbox-border-brand)"
                              markerEnd="url(#nsg-arrow)"
                            />
                          );
                        })}
                        <g
                          role="button"
                          tabIndex={0}
                          aria-label={node.title}
                          onClick={() => setSelected(node.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setSelected(node.id);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r={node.id === selected ? 34 : 28}
                            fill="var(--chatbox-background-brand-secondary)"
                            stroke="var(--chatbox-brand)"
                          />
                          <text
                            x={x}
                            y={y + 52}
                            textAnchor="middle"
                            fontSize={14}
                            fill="var(--chatbox-tint-primary)"
                          >
                            {node.title}
                            {node.status === 'archived' ? '（已归档）' : ''}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </Box>
            ) : (
              <Stack gap="xs">
                {visible.map((asset) => (
                  <UnstyledButton
                    key={asset.id}
                    onClick={() => setSelected(asset.id)}
                    p="md"
                    className="rounded-lg border border-solid border-chatbox-border-primary"
                    bg={
                      asset.id === selected
                        ? 'var(--chatbox-background-brand-secondary)'
                        : 'transparent'
                    }
                  >
                    <Flex justify="space-between" gap="sm">
                      <Text fw={500}>{asset.title}</Text>
                      <Badge variant="light" color="gray">
                        {asset.origin === 'user'
                          ? '用户创建'
                          : asset.origin === 'automatic'
                          ? '自动产生'
                          : '来源待核对'}
                      </Badge>
                    </Flex>
                    <Text size="xs" c="chatbox-tertiary" mt="xs">
                      {asset.scope === 'conversation'
                        ? '单个对话'
                        : asset.scope === 'character'
                        ? '角色范围'
                        : asset.scope === 'account'
                        ? '空间范围'
                        : '未指定注入范围'}{' '}
                      ·{' '}
                      {asset.status === 'active'
                        ? '启用'
                        : asset.status === 'archived'
                        ? '已归档'
                        : asset.status}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            )}
            {!error && !visible.length && (
              <Stack align="center" py={70}>
                <Title order={5}>
                  {value ? (graph ? '还没有语义网节点' : '还没有记忆') : '正在载入…'}
                </Title>
                <Text size="sm" c="chatbox-tertiary">
                  当前空间的资产会显示在这里。
                </Text>
              </Stack>
            )}
          </Box>
          {current && (
            <Stack w={{ base: '100%', sm: 320 }} gap="sm">
              <Title order={5}>{current.title}</Title>
              <Button
                variant="light"
                disabled={rows.find((r) => r.id === current.id)?.type === 'current'}
                onClick={() => setEditing(current.id)}
              >
                编辑配置
              </Button>
              <Text size="xs" c="chatbox-tertiary">
                空间：{data.spaces.spaces.find((s) => s.id === data.spaceId)?.name}
              </Text>
              <Text size="xs" c="chatbox-tertiary">
                来源：
                {current.origin === 'user'
                  ? '用户创建'
                  : current.origin === 'automatic'
                  ? '自动产生'
                  : '待核对'}
              </Text>
              {currentPolicy && (
                <Text size="xs" c="chatbox-tertiary">
                  可用角色：
                  {[
                    currentPolicy.owner_character_id,
                    ...(Array.isArray(currentPolicy.readers) ? currentPolicy.readers : []),
                  ]
                    .filter(Boolean)
                    .map((id) => data.characters.find((r) => r.id === id)?.name ?? '原有角色')
                    .join('、') || '未指定'}
                  {Array.isArray(currentPolicy.continuity_ids) &&
                  currentPolicy.continuity_ids.length
                    ? ` · 限定 ${currentPolicy.continuity_ids.length} 个世界 / 连续性`
                    : ' · 不额外限制世界'}
                </Text>
              )}
              <div className="msg-content">
                <Markdown>{graph ? current.body : body}</Markdown>
              </div>
            </Stack>
          )}
        </Flex>
      </Stack>
      {editing && (
        <AssetEditor
          key={`${data.spaceId}:${graph}:${editing}`}
          graph={graph}
          original={editing === 'new' ? null : rows.find((r) => r.id === editing) ?? null}
          nodes={rows}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            provenance.reload();
            if (selected) setSelected(null);
          }}
        />
      )}
    </Page>
  );
}
