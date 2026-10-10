import React, { useEffect, useState } from 'react'
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { IconRefresh, IconSettings } from '@tabler/icons-react'
import {
  injectionDescription,
  managedDdm,
  stateConstraints,
  stateDimensions,
  stateManagement,
  type ManagedDdm,
  type StateManagement,
  type StateSnapshot,
} from '../../contracts/mo-state'
import { api } from './api'
import { useProduct } from './context'
import Page from './Page'

const phaseNames: Record<string, string> = {
  staged: '已排队',
  applying: '已开始',
  projected: '已投影，回复未提交',
  completed: '回复已完成',
  failed: '处理失败',
}
const time = (value: string) => new Date(value).toLocaleString()
const failure = (error: unknown) => (error instanceof Error ? error.message : '读取失败')
const panel = { border: '1px solid var(--chatbox-border-primary)', borderRadius: 12 }
const dimensions = ['scene_constraint', 'physiological_state', 'epistemic_state', 'relational_stance', 'emotional_tone']

export function MoStateManagement() {
  const { data, openSettings } = useProduct()
  const [report, setReport] = useState<StateManagement | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState('current')
  const [tab, setTab] = useState<string | null>('state')
  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    void api(`/api/resources?kind=state-management&space=${data.spaceId}`, undefined, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          setReport(stateManagement(value, data.spaceId))
          setError('')
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(failure(e))
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [data.spaceId, revision])
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setRevision((v) => v + 1)
    }, 15000)
    return () => clearInterval(timer)
  }, [])
  const operations = report?.operations ?? []
  const snapshot =
    selected === 'current' ? report?.current_snapshot : operations.find((op) => op.operation_id === selected)?.snapshot
  const operation =
    selected === 'current'
      ? operations.find((op) => snapshot && op.snapshot?.snapshot_id === snapshot.snapshot_id)
      : operations.find((op) => op.operation_id === selected)
  const role = data.characters.find((item) => item.id === snapshot?.character_id)
  return (
    <Page
      title="MO State"
      right={
        <Flex gap="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconSettings size={16} />}
            onClick={() => openSettings('mo-state')}
          >
            运行设置
          </Button>
          <Button
            variant="subtle"
            size="xs"
            aria-label="刷新 MO State"
            loading={loading}
            leftSection={<IconRefresh size={16} />}
            onClick={() => setRevision((v) => v + 1)}
          >
            刷新
          </Button>
        </Flex>
      }
    >
      <Stack p="md" gap="md" maw={1040} mx="auto">
        <Flex align="center" justify="space-between" gap="xs" wrap="wrap">
          <Text size="sm" c="chatbox-secondary">
            {data.spaces.spaces.find((space) => space.id === data.spaceId)?.name} · 当前个人空间
          </Text>
          {report && (
            <Badge variant="light" color={report.degraded ? 'orange' : 'gray'}>
              {report.degraded ? '状态已降级' : report.initialized ? '已有状态记录' : '尚无自治状态记录'}
            </Badge>
          )}
        </Flex>
        <Text size="xs" c="chatbox-tertiary">
          查看 Core 保存的状态与处理依据。页面可见时每 15 秒更新，读取不会触发模型请求。
        </Text>
        {error && (
          <Alert color="red" title="无法读取最新状态">
            {error}
            {report && <Text size="sm">以下保留上次读取结果，尚未确认最新状态。</Text>}
          </Alert>
        )}
        {report?.last_error && (
          <Alert color="orange" title="最近运行错误">
            {report.last_error}
          </Alert>
        )}
        {!report && loading ? (
          <Loader size="sm" />
        ) : (
          <Tabs value={tab} onChange={setTab} keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="state">状态与依据</Tabs.Tab>
              <Tabs.Tab value="records">处理记录</Tabs.Tab>
              <Tabs.Tab value="ddm">角色侧写</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="state" pt="md">
              <Stack gap="md">
                {report && (
                  <Select
                    label="查看状态"
                    value={selected}
                    allowDeselect={false}
                    onChange={(value) => value && setSelected(value)}
                    data={[
                      { value: 'current', label: '当前已保存状态' },
                      ...operations.map((op) => ({
                        value: op.operation_id,
                        label: `${time(op.updated_at)} · ${phaseNames[op.phase]}`,
                      })),
                      ...(selected !== 'current' && !operation
                        ? [{ value: selected, label: '这条记录已不在最近 20 条中' }]
                        : []),
                    ]}
                  />
                )}
                {operation?.error && (
                  <Alert color="red" title="本次处理错误">
                    {operation.error}
                  </Alert>
                )}
                {snapshot ? (
                  <>
                    <Box p="md" style={panel}>
                      <Text fw={600} size="sm">
                        实际注入
                      </Text>
                      <Text size="sm" mt={4}>
                        {injectionDescription(operation)}
                      </Text>
                      <Text size="xs" c="chatbox-secondary" mt="xs">
                        {role?.name ?? snapshot.character_id ?? '未记录角色'} · {time(snapshot.created_at)}
                      </Text>
                      {snapshot.conversation_id && (
                        <Text size="xs" c="chatbox-secondary" style={{ overflowWrap: 'anywhere' }}>
                          来源对话：
                          {data.conversations.find((item) => item.id === snapshot.conversation_id)?.title ??
                            snapshot.conversation_id}
                        </Text>
                      )}
                      {operation?.response && (
                        <Text size="xs" c="chatbox-tertiary" style={{ overflowWrap: 'anywhere' }}>
                          请求 {operation.response.request_id}
                        </Text>
                      )}
                      {!!operation?.response?.warnings.length && (
                        <Text size="sm" c="orange" mt="xs">
                          {operation.response.warnings.join('；')}
                        </Text>
                      )}
                    </Box>
                    <SnapshotView snapshot={snapshot} />
                  </>
                ) : (
                  report && (
                    <Text size="sm" c="chatbox-secondary">
                      {selected === 'current'
                        ? '尚未保存自治状态快照。启用闭环自治后的对话会产生记录；状态投影模式不保存自治快照。'
                        : operation
                          ? '这次处理尚未保存快照，可在处理记录中查看阶段与错误。'
                          : '这条记录已不在最近 20 条中，请选择其他状态。'}
                    </Text>
                  )
                )}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="records" pt="md">
              <Stack gap="sm">
                <Text size="xs" c="chatbox-secondary">
                  最近 20 条处理记录。阶段是最后保存的结果，不代表任务此刻仍在执行。
                </Text>
                {!operations.length && report && (
                  <Text size="sm" c="chatbox-secondary">
                    当前个人空间没有自治处理记录。
                  </Text>
                )}
                {operations.map((op) => (
                  <Box key={op.operation_id} p="md" style={panel}>
                    <Flex align="center" justify="space-between" gap="xs" wrap="wrap">
                      <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                        <Flex gap="xs" align="center" wrap="wrap">
                          <Badge
                            variant="light"
                            color={op.phase === 'failed' ? 'red' : op.phase === 'completed' ? 'green' : 'gray'}
                          >
                            {phaseNames[op.phase]}
                          </Badge>
                          <Text size="xs" c="chatbox-secondary">
                            {time(op.updated_at)}
                            {op.snapshot && ` · 快照 #${op.snapshot.snapshot_revision}`}
                          </Text>
                        </Flex>
                        <Text size="sm">{injectionDescription(op)}</Text>
                        {op.error && (
                          <Text size="sm" c="red" style={{ overflowWrap: 'anywhere' }}>
                            {op.error}
                          </Text>
                        )}
                      </Stack>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          setSelected(op.operation_id)
                          setTab('state')
                        }}
                      >
                        查看
                      </Button>
                    </Flex>
                  </Box>
                ))}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="ddm" pt="md">
              <DdmManagement />
            </Tabs.Panel>
          </Tabs>
        )}
      </Stack>
    </Page>
  )
}

function SnapshotView({ snapshot }: { snapshot: StateSnapshot }) {
  const { navigate } = useProduct()
  const sections = stateConstraints(snapshot.state_context)
  const scene = snapshot.scene
  const sceneNames: Record<string, string> = {
    inactive: '未激活',
    active: '进行中',
    transitioning: '切换中',
    closed: '已结束',
  }
  const contractNames: Record<string, string> = {
    builtin_default: 'Core 内置',
    embedded: 'Core 内置',
    file: '全局文件',
    space: '个人空间覆盖',
    builtin: 'Core 内置',
    personal_space: '个人空间覆盖',
  }
  return (
    <Stack gap="md">
      <Flex gap="xs" align="center" wrap="wrap">
        <Title order={5}>快照 #{snapshot.snapshot_revision}</Title>
        {snapshot.degraded && (
          <Badge color="orange" variant="light">
            降级快照
          </Badge>
        )}
      </Flex>
      <Box p="md" style={panel}>
        <Flex justify="space-between" align="center">
          <Text fw={600} size="sm">
            当前场景
          </Text>
          <Badge variant="light" color="gray">
            {scene.status ? (sceneNames[scene.status] ?? scene.status) : '未记录'}
          </Badge>
        </Flex>
        <Text size="sm" mt="xs">
          {scene.location ?? '地点未确定'} · {scene.timeframe ?? '时间未确定'}
        </Text>
        {scene.focus && (
          <Text size="sm" mt="xs">
            {scene.focus}
          </Text>
        )}
        {!!scene.participants.length && (
          <Text size="sm" mt="xs">
            参与者：{scene.participants.join('、')}
          </Text>
        )}
        {!!scene.open_threads.length && (
          <Text size="sm" mt="xs">
            未完事项：{scene.open_threads.join('；')}
          </Text>
        )}
        {!!scene.constraints.length && (
          <Text size="sm" mt="xs">
            场景限制：{scene.constraints.join('；')}
          </Text>
        )}
      </Box>
      {!sections.length && snapshot.state_context.trim() ? (
        <Textarea
          label="原始状态上下文（未识别展示格式）"
          readOnly
          autosize
          minRows={3}
          maxRows={16}
          value={snapshot.state_context}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {dimensions.map((key) => (
            <Box key={key} p="md" style={panel}>
              <Text fw={600} size="sm">
                {stateDimensions[key]}
              </Text>
              {(sections.find((section) => section.key === key)?.lines ?? []).length ? (
                sections
                  .find((section) => section.key === key)!
                  .lines.map((line, index) => (
                    <Text key={index} size="sm" mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
                      {line}
                    </Text>
                  ))
              ) : (
                <Text size="sm" c="chatbox-tertiary" mt="xs">
                  本轮未生成此类约束
                </Text>
              )}
            </Box>
          ))}
        </SimpleGrid>
      )}
      {sections
        .filter(
          (section) => ['ddm_constraints', 'effective_dispositions'].includes(section.key) && section.lines.length
        )
        .map((section) => (
          <Box key={section.key} p="md" style={panel}>
            <Text fw={600} size="sm">
              {section.label}
            </Text>
            {section.lines.map((line, index) => (
              <Text key={index} size="sm" mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
                {line}
              </Text>
            ))}
          </Box>
        ))}
      {!!snapshot.warnings.length && (
        <Alert color="orange" title="状态提示">
          {snapshot.warnings.join('；')}
        </Alert>
      )}
      <Accordion variant="separated">
        <Accordion.Item value="evidence">
          <Accordion.Control>输入依据{snapshot.records && ` · ${snapshot.records.length} 条`}</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Text size="xs" c="chatbox-secondary">
                这是本次检索捕获的记忆与语义网条目，不表示每条都命中了规则；内容可能随后修改，ID 保留本次来源。
              </Text>
              {snapshot.records === null ? (
                <Text size="sm">旧快照未记录逐条输入证据。</Text>
              ) : !snapshot.records.length ? (
                <Text size="sm">本次没有检索到输入条目。</Text>
              ) : (
                snapshot.records.map((item) => (
                  <Box key={`${item.kind}:${item.space_id}:${item.id}`}>
                    <Flex gap="xs" wrap="wrap">
                      <Badge size="sm" variant="light">
                        {item.kind === 'memory' ? '记忆' : '语义网'}
                      </Badge>
                      {!item.state_eligible && (
                        <Badge size="sm" color="gray">
                          不参与状态投影
                        </Badge>
                      )}
                    </Flex>
                    <Text size="xs" mt={4} style={{ overflowWrap: 'anywhere' }}>
                      {item.id}
                    </Text>
                    <Text size="xs" c="chatbox-tertiary" style={{ overflowWrap: 'anywhere' }}>
                      来源空间 {item.space_id}
                    </Text>
                  </Box>
                ))
              )}
              {!!snapshot.excluded.length && (
                <Alert color="orange" title="认知边界">
                  未向角色披露的记忆：{snapshot.excluded.join('、')}
                </Alert>
              )}
              <Flex gap="xs" wrap="wrap">
                <Button variant="light" size="xs" onClick={() => navigate('/memory')}>
                  查看记忆
                </Button>
                <Button variant="light" size="xs" onClick={() => navigate('/nsg')}>
                  查看语义网
                </Button>
              </Flex>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="audit">
          <Accordion.Control>规则与版本</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Text size="sm">命中规则：{snapshot.rules.join('、') || '无'}</Text>
              <Text size="sm">
                规则来源：
                {snapshot.contract_source
                  ? (contractNames[snapshot.contract_source] ?? snapshot.contract_source)
                  : '未记录'}
              </Text>
              <Text size="sm">检索状态：{snapshot.retrieval_status ?? '未记录'}</Text>
              {snapshot.sources.map((source) => (
                <Text key={source.space_id} size="xs" c="chatbox-secondary" style={{ overflowWrap: 'anywhere' }}>
                  空间 {source.space_id} · 记忆版本 {source.dmw_revision} · 语义网版本 {source.nsg_revision} · 场景版本{' '}
                  {source.scene_revision}
                </Text>
              ))}
              <Textarea
                label="原始状态上下文"
                readOnly
                autosize
                minRows={3}
                maxRows={16}
                value={snapshot.state_context}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  )
}

function DdmManagement() {
  const { data, runningConversationId } = useProduct()
  const [characterId, setCharacterId] = useState<string | null>(data.characters[0]?.id ?? null)
  const [profile, setProfile] = useState<ManagedDdm>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!characterId) return
    const abort = new AbortController()
    setLoading(true)
    setError('')
    setNotice('')
    setProfile(null)
    void api(`/api/resources?kind=state-ddm&space=${data.spaceId}&id=${characterId}`, undefined, abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setProfile(managedDdm(value, characterId))
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(failure(e))
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [data.spaceId, characterId, revision])
  async function reset() {
    setBusy(true)
    setError('')
    try {
      await api('/api/resources', { command: 'state-ddm-reset', spaceId: data.spaceId, id: characterId })
      setProfile(null)
      setNotice('派生侧写已重置，下次符合生成条件的对话会重新生成。')
      setConfirm(false)
    } catch (e) {
      setError(failure(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack gap="md">
      <Text size="sm" c="chatbox-secondary">
        角色侧写（DDM）是 Core
        依据角色配置生成的表达倾向缓存。这里可查看和重置派生缓存；作者提供的侧写覆盖仍在角色配置中管理。
      </Text>
      <Select
        label="角色"
        placeholder="选择角色"
        value={characterId}
        onChange={setCharacterId}
        allowDeselect={false}
        disabled={busy}
        data={data.characters.map((item) => ({ value: item.id, label: item.name }))}
      />
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      {!characterId ? (
        <Text size="sm" c="chatbox-secondary">
          当前个人空间没有角色。
        </Text>
      ) : loading ? (
        <Loader size="sm" />
      ) : profile ? (
        <>
          <Flex gap="xs" align="center" wrap="wrap">
            <Badge variant="light">版本 {profile.revision}</Badge>
            <Text size="xs" c="chatbox-secondary">
              {profile.profile}
            </Text>
          </Flex>
          {profile.dispositions.map((item) => (
            <Box p="md" style={panel} key={item.id}>
              <Flex justify="space-between" gap="xs" wrap="wrap">
                <Text fw={600} size="sm">
                  {item.id}
                </Text>
                <Text size="xs" c="chatbox-secondary">
                  基础激活 {item.base}
                </Text>
              </Flex>
              <Text size="sm" mt="xs">
                {item.description}
              </Text>
              {!!item.constraints.length && (
                <Text size="sm" c="chatbox-secondary" mt="xs">
                  {item.constraints.join('；')}
                </Text>
              )}
            </Box>
          ))}
          <Divider />
          <Button
            variant="light"
            color="orange"
            style={{ alignSelf: 'flex-start' }}
            disabled={!!runningConversationId}
            onClick={() => setConfirm(true)}
          >
            重置派生侧写
          </Button>
          {!!runningConversationId && (
            <Text size="xs" c="chatbox-secondary">
              当前对话完成后可重置侧写。
            </Text>
          )}
        </>
      ) : (
        !error && (
          <Text size="sm" c="chatbox-secondary">
            当前角色没有派生侧写缓存。启用 DDM 后可在后续对话中生成；存在作者覆盖时使用作者配置。
          </Text>
        )
      )}
      {characterId && (
        <Button
          variant="subtle"
          size="xs"
          loading={loading}
          disabled={busy}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setRevision((v) => v + 1)}
        >
          刷新侧写
        </Button>
      )}
      <Modal
        opened={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="重置派生侧写"
        centered
        closeOnClickOutside={!busy}
        closeOnEscape={!busy}
        withCloseButton={!busy}
      >
        <Stack gap="md">
          {error && <Alert color="red">{error}</Alert>}
          <Text size="sm">
            清除当前个人空间中这个角色的派生缓存。角色设定、作者侧写、记忆和已有快照保留；后续符合条件的对话会发起模型请求重新生成。
          </Text>
          <Flex justify="flex-end" gap="xs">
            <Button variant="default" disabled={busy} onClick={() => setConfirm(false)}>
              取消
            </Button>
            <Button color="orange" loading={busy} onClick={() => void reset()}>
              确认重置
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Stack>
  )
}
