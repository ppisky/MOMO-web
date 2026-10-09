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
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string | null>('all');
  const [origin, setOrigin] = useState<string | null>('all');
  const [body, setBody] = useState('');
  useEffect(() => { setSelected(null); setBody(''); }, [data.spaceId, graph]);
  const ledger = provenance.value ? record(record(provenance.value).ledger) : null;
  const records = ledger ? record(ledger.records) : {};
  const assets: Asset[] = value
    ? list(value, (raw) => {
        const a = record(raw);
        const id = text(a.id, 'id');
        const entry = records[id] ? record(records[id]) : null;
        const revisions = entry && Array.isArray(entry.revisions) ? entry.revisions : [];
        const latest = revisions.length ? record(record(revisions[0]).context) : null;
        const origin = latest?.proposer === 'local_author' ? 'user' : latest ? 'automatic' : 'unknown';
        const aliases = Array.isArray(a.aliases)
          ? a.aliases.filter((v): v is string => typeof v === 'string')
          : [];
        return {
          id,
          title: aliases[0] ?? id,
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
                return typeof v.target === 'string' ? [v.target] : typeof v.to === 'string' ? [v.to] : [];
              })
            : [],
        };
      })
    : [];
  const visible = assets.filter(
    (a) =>
      (a.title + ' ' + a.body).toLowerCase().includes(query.toLowerCase()) &&
      (scope === 'all' || a.scope === scope) &&
      (origin === 'all' || a.origin === origin),
  );
  const current = assets.find((a) => a.id === selected);
  useEffect(() => {
    setBody('');
    if (!graph && selected) {
      const abort = new AbortController();
      void api(
        `/api/resources?space=${data.spaceId}&kind=memory-content&id=${encodeURIComponent(selected)}`,
        undefined,
        abort.signal,
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
        <Button variant="subtle" size="xs" onClick={() => { reload(); provenance.reload(); }}>
          刷新
        </Button>
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
              { value: 'conversation', label: '单个对话' },
              { value: 'character', label: '角色全部对话' },
              { value: 'account', label: '空间范围' },
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
                    bg={asset.id === selected ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
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
                          ? '角色全部对话'
                          : asset.scope === 'account'
                            ? '空间范围'
                            : '未指定注入范围'}{' '}
                      · {asset.status === 'active' ? '启用' : asset.status}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            )}
            {!error && !visible.length && (
              <Stack align="center" py={70}>
                <Title order={5}>{value ? (graph ? '还没有语义网节点' : '还没有记忆') : '正在载入…'}</Title>
                <Text size="sm" c="chatbox-tertiary">
                  当前空间的资产会显示在这里。
                </Text>
              </Stack>
            )}
          </Box>
          {current && (
            <Stack w={{ base: '100%', sm: 320 }} gap="sm">
              <Title order={5}>{current.title}</Title>
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
              <div className="msg-content">
                <Markdown>{graph ? current.body : body}</Markdown>
              </div>
            </Stack>
          )}
        </Flex>
      </Stack>
    </Page>
  );
}
