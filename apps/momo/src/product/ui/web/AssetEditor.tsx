import React, { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Flex,
  Modal,
  MultiSelect,
  TagsInput,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Divider,
} from '@mantine/core'
import { record, list, text } from '../../contracts/core'
import {
  metadata,
  node,
  policy,
  newPolicy,
  edgeTypes,
  type MemoryMetadata,
  type Node,
  type Policy,
} from '../../contracts/assets'
import { useProduct } from './context'
import { api } from './api'

type Identity = { conversation_id: string; continuity_id: string }
export function AssetEditor({
  graph,
  original,
  nodes,
  onClose,
  onSaved,
}: {
  graph: boolean
  original: Record<string, unknown> | null
  nodes: Record<string, unknown>[]
  onClose: () => void
  onSaved: () => void
}) {
  const { data } = useProduct()
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [revision, setRevision] = useState<number | null>(null),
    [access, setAccess] = useState<Policy>(newPolicy(data.spaceId))
  const [identities, setIdentities] = useState<Identity[]>([])
  const [origin, setOrigin] = useState('用户创建')
  const [body, setBody] = useState('')
  const [m, setM] = useState<MemoryMetadata>({
    id: crypto.randomUUID(),
    type: 'event',
    importance: 0.7,
    weight: 0.7,
    touch_at: 0,
    decay_at: 0,
    archived_at: null,
    relations: {},
    tags: [],
    aliases: [],
    injection_scope: 'character',
    injection_character_id: null,
    injection_conversation_id: null,
    status: 'active',
  })
  const [n, setN] = useState<Node>({
    id: crypto.randomUUID(),
    graph_id: 'default',
    type: 'rule',
    importance: 0.7,
    mode: 'canon',
    status: 'active',
    zone: 'auto',
    anchors: [],
    condition: '',
    trigger: '',
    constraint: '',
    consequence: '',
    source_character_ids: [],
    inject_character_ids: [],
    edges: [],
  })
  useEffect(() => {
    const abort = new AbortController()
    void Promise.all([
      api(`/api/resources?space=${data.spaceId}&kind=provenance&graph=${graph}`, undefined, abort.signal),
      api(`/api/resources?space=${data.spaceId}&kind=identities`, undefined, abort.signal),
      original && !graph
        ? api(
            `/api/resources?space=${data.spaceId}&kind=memory-content&id=${encodeURIComponent(String(original.id))}`,
            undefined,
            abort.signal
          )
        : Promise.resolve(null),
    ])
      .then(([provenance, mappings, document]) => {
        const histories = record(record(record(provenance).ledger).records)
        const history = original && histories[String(original.id)] ? record(histories[String(original.id)]) : null
        setRevision(original ? (history ? list(history.revisions, record).length : 0) : null)
        if (history?.policy) setAccess(policy(history.policy))
        else setAccess({ ...newPolicy(data.spaceId), fact_kind: graph ? 'rule' : 'experience' })
        if (history && Array.isArray(history.revisions) && history.revisions.length) {
          const author = record(record(history.revisions[0]).context).proposer
          setOrigin(
            author === 'local_author'
              ? '用户创建'
              : ['dmw_distiller', 'nsg_governor'].includes(String(author))
              ? '自动产生'
              : `来源：${String(author)}`
          )
        } else if (original) setOrigin('原始来源待核对')
        setIdentities(
          list(mappings, (v) => {
            const i = record(v)
            return {
              conversation_id: text(i.conversation_id, 'conversation_id'),
              continuity_id: text(i.continuity_id, 'continuity_id'),
            }
          })
        )
        if (original && graph) setN(node(original))
        if (document) {
          const d = record(document)
          setM(metadata(d.metadata))
          setBody(text(d.body, 'body'))
        }
        setReady(true)
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
    return () => abort.abort()
  }, [data.spaceId, graph, original])
  const roles = data.characters.map((r) => ({ value: r.id, label: r.name }))
  const roleChoices = [
    ...roles,
    ...[access.owner_character_id, ...access.readers]
      .filter((id): id is string => !!id && !roles.some((r) => r.value === id))
      .map((id) => ({ value: id, label: `原有角色 · ${id.slice(0, 8)}` })),
  ]
  const worlds = Array.from(new Set([...identities.map((i) => i.continuity_id), ...access.continuity_ids])).map(
    (id) => ({
      value: id,
      label:
        identities
          .filter((i) => i.continuity_id === id)
          .map(
            (i) => data.conversations.find((c) => c.id === i.conversation_id)?.title ?? i.conversation_id.slice(0, 8)
          )
          .join(' / ') || `保留的世界 · ${id.slice(0, 8)}`,
    })
  )
  const conversations = data.conversations
    .filter((c) => c.character_id === access.owner_character_id)
    .map((c) => ({ value: c.id, label: c.title }))
  if (m.injection_conversation_id && !conversations.some((c) => c.value === m.injection_conversation_id)) {
    conversations.push({ value: m.injection_conversation_id, label: '原目标对话已不可用（保留绑定，不扩大注入范围）' })
  }
  const nodeTargets = nodes
    .filter((v) => v.graph_id === n.graph_id && v.id !== n.id)
    .map((v) => ({
      value: String(v.id),
      label: Array.isArray(v.anchors) && v.anchors[0] ? String(v.anchors[0]) : String(v.id),
    }))
  const status = graph ? n.status : m.status
  async function save(nextStatus = status) {
    setBusy(true)
    setError('')
    try {
      if (!access.owner_character_id && !access.readers.length) throw Error('请选择可使用这条资产的角色')
      if (!graph && (!body.trim() || !m.aliases[0]?.trim())) throw Error('请填写记忆名称与正文')
      if (!graph && !['character', 'conversation', 'account'].includes(m.injection_scope ?? ''))
        throw Error('请选择记忆的注入范围')
      if (!graph && m.injection_scope === 'conversation' && !m.injection_conversation_id)
        throw Error('请选择注入的对话')
      if (graph && !n.anchors.length) throw Error('至少填写一个检索锚点')
      if (access.fact_kind === 'rule' && !access.continuity_ids.length) throw Error('规则需要选择所属世界 / 连续性')
      const content = graph
        ? {
            kind: 'semantic_graph',
            node: {
              ...n,
              status: nextStatus,
              inject_character_ids: [
                ...new Set([access.owner_character_id, ...access.readers].filter((v): v is string => !!v)),
              ],
            },
          }
        : {
            kind: 'memory',
            metadata: {
              ...m,
              status: nextStatus,
              archived_at: nextStatus === 'archived' ? m.archived_at ?? Math.floor(Date.now() / 1000) : null,
              injection_character_id: access.owner_character_id,
              injection_conversation_id: m.injection_scope === 'conversation' ? m.injection_conversation_id : null,
            },
            body,
          }
      await api('/api/assets', {
        spaceId: data.spaceId,
        expected_revision: revision,
        content,
        policy: { ...access, revision: access.revision + 1 },
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      opened
      onClose={() => {
        if (!busy) onClose()
      }}
      size="xl"
      centered
      title={`${original ? '编辑' : '新建'}${graph ? '语义网节点' : '记忆'}`}
    >
      <Stack gap="md">
        {error && <Alert color="red">{error}。版本冲突时请关闭并重新打开，核对最新内容后再保存。</Alert>}
        {!ready ? (
          <Text>{error ? '无法载入配置' : '正在读取配置…'}</Text>
        ) : (
          <>
            <Text size="xs" c="dimmed">
              {origin} · {original ? `修订 ${revision}` : '尚未保存'} · {status === 'archived' ? '已归档' : '启用中'}
            </Text>
            {!graph ? (
              <>
                <TextInput
                  label="记忆名称"
                  required
                  value={m.aliases[0] ?? ''}
                  onChange={(e) => setM({ ...m, aliases: [e.currentTarget.value, ...m.aliases.slice(1)] })}
                />
                <Select
                  label="记忆类型"
                  disabled={!!original}
                  data={[
                    { value: 'event', label: '事件' },
                    { value: 'character', label: '人物' },
                    { value: 'relationship', label: '关系' },
                    { value: 'world', label: '世界' },
                  ]}
                  value={m.type}
                  onChange={(v) => setM({ ...m, type: v ?? 'event' })}
                />
                <Textarea
                  label="记忆正文"
                  required
                  autosize
                  minRows={5}
                  maxRows={14}
                  value={body}
                  onChange={(e) => setBody(e.currentTarget.value)}
                />
                <TagsInput
                  label="标签"
                  description="输入后按回车添加"
                  value={m.tags}
                  onChange={(tags) => setM({ ...m, tags })}
                />
              </>
            ) : (
              <>
                <TagsInput
                  label="检索锚点"
                  description="输入后按回车添加，第一个作为节点名称。"
                  required
                  value={n.anchors}
                  onChange={(anchors) => setN({ ...n, anchors })}
                />
                <Flex gap="sm">
                  <TextInput
                    flex={1}
                    label="图谱标识"
                    disabled={!!original}
                    value={n.graph_id}
                    onChange={(e) => setN({ ...n, graph_id: e.currentTarget.value, edges: [] })}
                  />
                  <TextInput
                    flex={1}
                    label="节点类型"
                    value={n.type}
                    onChange={(e) => setN({ ...n, type: e.currentTarget.value })}
                  />
                </Flex>
                <Flex gap="sm">
                  <Select
                    flex={1}
                    label="节点模式"
                    data={[
                      { value: 'canon', label: '正式' },
                      { value: 'draft', label: '草稿' },
                    ]}
                    value={n.mode}
                    onChange={(v) => setN({ ...n, mode: v ?? 'canon' })}
                  />
                  <Select
                    flex={1}
                    label="注入区域"
                    data={[
                      { value: 'auto', label: '自动' },
                      { value: '0', label: '0 · 核心约束' },
                      { value: '2', label: '2 · 常规语境' },
                      { value: '3', label: '3 · 强关联' },
                    ]}
                    value={n.zone}
                    onChange={(v) => setN({ ...n, zone: v ?? 'auto' })}
                  />
                </Flex>
                {(['trigger', 'condition', 'constraint', 'consequence'] as const).map((key, i) => (
                  <Textarea
                    key={key}
                    label={['触发', '条件', '约束', '结果'][i]}
                    autosize
                    minRows={2}
                    value={n[key]}
                    onChange={(e) => setN({ ...n, [key]: e.currentTarget.value })}
                  />
                ))}
                <Divider label="有向关系 · 当前节点 → 目标节点" />
                {n.edges.map((edge, i) => (
                  <Stack
                    key={i}
                    gap="xs"
                    p="sm"
                    className="rounded-lg border border-solid border-chatbox-border-primary"
                  >
                    <Flex gap="sm">
                      <Select
                        flex={1}
                        label="关系类别"
                        data={Object.entries(edgeTypes).map(([value, v]) => ({ value, label: v.label }))}
                        value={edge.category}
                        onChange={(v) => {
                          if (v)
                            setN({
                              ...n,
                              edges: n.edges.map((e, j) =>
                                j === i ? { ...e, category: v, relation: Object.keys(edgeTypes[v]!.relations)[0]! } : e
                              ),
                            })
                        }}
                      />
                      <Select
                        flex={1}
                        label="关系"
                        data={Object.entries(edgeTypes[edge.category]?.relations ?? {}).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        value={edge.relation}
                        onChange={(v) =>
                          setN({
                            ...n,
                            edges: n.edges.map((e, j) => (j === i ? { ...e, relation: v ?? e.relation } : e)),
                          })
                        }
                      />
                    </Flex>
                    <Select
                      label="目标节点"
                      searchable
                      data={[
                        ...nodeTargets,
                        ...(nodeTargets.some((v) => v.value === edge.target)
                          ? []
                          : [{ value: edge.target, label: edge.target }]),
                      ].filter((v) => v.value)}
                      value={edge.target}
                      onChange={(v) =>
                        setN({ ...n, edges: n.edges.map((e, j) => (j === i ? { ...e, target: v ?? '' } : e)) })
                      }
                    />
                    <Flex align="end" gap="sm">
                      <NumberInput
                        label="关系权重"
                        min={0}
                        max={1}
                        step={0.1}
                        value={edge.weight}
                        onChange={(v) =>
                          setN({ ...n, edges: n.edges.map((e, j) => (j === i ? { ...e, weight: Number(v) } : e)) })
                        }
                      />
                      <Button
                        variant="subtle"
                        color="red"
                        onClick={() => setN({ ...n, edges: n.edges.filter((_, j) => j !== i) })}
                      >
                        移除关系
                      </Button>
                    </Flex>
                  </Stack>
                ))}
                <Button
                  variant="light"
                  disabled={!nodeTargets.length}
                  onClick={() =>
                    setN({
                      ...n,
                      edges: [
                        ...n.edges,
                        { category: 'structural', relation: 'part_of', weight: 0.7, target: nodeTargets[0]!.value },
                      ],
                    })
                  }
                >
                  添加关系
                </Button>
              </>
            )}
            <Flex gap="sm">
              <NumberInput
                flex={1}
                label="重要性"
                min={0}
                max={1}
                step={0.1}
                value={graph ? n.importance : m.importance ?? 0.7}
                onChange={(v) =>
                  graph ? setN({ ...n, importance: Number(v) }) : setM({ ...m, importance: Number(v) })
                }
              />
              {!graph && (
                <NumberInput
                  flex={1}
                  label="权重"
                  min={0}
                  max={1}
                  step={0.1}
                  value={m.weight ?? 0.7}
                  onChange={(v) => setM({ ...m, weight: Number(v) })}
                />
              )}
            </Flex>
            <Divider label="注入范围" />
            <Select
              label="所属角色"
              searchable
              data={roleChoices}
              value={access.owner_character_id}
              onChange={(v) => {
                setAccess({ ...access, owner_character_id: v })
                setM({ ...m, injection_character_id: v, injection_conversation_id: null })
              }}
            />
            {graph ? (
              <MultiSelect
                label="其他可使用的角色"
                data={roleChoices.filter((r) => r.value !== access.owner_character_id)}
                value={access.readers}
                onChange={(readers) => setAccess({ ...access, readers })}
              />
            ) : (
              <>
                <Select
                  label="注入范围"
                  data={[
                    { value: 'character', label: '这个角色的所有对话' },
                    { value: 'conversation', label: '这个角色的单个对话' },
                    ...(m.injection_scope === 'account'
                      ? [{ value: 'account', label: '原有空间范围（仍受角色授权限制）' }]
                      : []),
                  ]}
                  value={m.injection_scope}
                  onChange={(v) => {
                    setM({ ...m, injection_scope: v, injection_conversation_id: null })
                    setAccess({ ...access, continuity_ids: [] })
                  }}
                />
                {m.injection_scope === 'conversation' && (
                  <Select
                    label="注入对话"
                    data={conversations}
                    value={m.injection_conversation_id}
                    onChange={(v) => setM({ ...m, injection_conversation_id: v })}
                  />
                )}
              </>
            )}
            <MultiSelect
              label="所属世界 / 连续性"
              description={
                graph
                  ? '规则必须指定世界。多个对话可属于同一世界，选择的是世界范围。'
                  : '留空表示不额外限制世界；单个对话的限制仍独立生效。'
              }
              searchable
              data={worlds}
              value={access.continuity_ids}
              onChange={(continuity_ids) => setAccess({ ...access, continuity_ids })}
            />
            {graph && !worlds.length && (
              <Text size="sm" c="dimmed">
                先为角色建立一个对话，即可选择它所属的世界。
              </Text>
            )}
            <details>
              <summary>高级授权</summary>
              <Stack mt="sm" gap="sm">
                <Select
                  label="事实类型"
                  data={Object.entries({
                    experience: '经历',
                    relationship: '关系',
                    commitment: '承诺',
                    preference: '偏好',
                    knowledge: '知识',
                    rule: '规则',
                    unknown: '未分类',
                  }).map(([value, label]) => ({ value, label }))}
                  value={access.fact_kind}
                  onChange={(v) => setAccess({ ...access, fact_kind: v ?? 'unknown' })}
                />
                {!graph && (
                  <MultiSelect
                    label="其他授权角色"
                    description="仍受上面的注入范围约束。"
                    data={roleChoices.filter((r) => r.value !== access.owner_character_id)}
                    value={access.readers}
                    onChange={(readers) => setAccess({ ...access, readers })}
                  />
                )}
                <TagsInput
                  label="功能标识限制"
                  description="输入后按回车添加，留空表示不限。"
                  value={access.function_ids}
                  onChange={(function_ids) => setAccess({ ...access, function_ids })}
                />
              </Stack>
            </details>
            <Flex justify="space-between" gap="sm" mt="sm">
              {original ? (
                <Button
                  variant="light"
                  color={status === 'archived' ? 'blue' : 'gray'}
                  disabled={busy}
                  onClick={() => void save(status === 'archived' ? 'active' : 'archived')}
                >
                  {status === 'archived' ? '恢复并保存' : '归档并保存'}
                </Button>
              ) : (
                <span />
              )}
              <Flex gap="sm">
                <Button variant="subtle" disabled={busy} onClick={onClose}>
                  取消
                </Button>
                <Button loading={busy} onClick={() => void save()}>
                  保存配置
                </Button>
              </Flex>
            </Flex>
          </>
        )}
      </Stack>
    </Modal>
  )
}
