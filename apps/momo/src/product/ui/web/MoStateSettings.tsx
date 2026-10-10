import React, { useEffect, useState } from 'react'
import { Alert, Button, Divider, Flex, NumberInput, Select, Stack, Switch, Text, Textarea, Title } from '@mantine/core'
import { record, text } from '../../contracts/core'
import { useResource } from './CoreSettings'
import { useProduct } from './context'
import { api } from './api'
function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(after).flatMap(([key, value]) => {
      if (JSON.stringify(before[key]) === JSON.stringify(value)) return []
      return [
        [
          key,
          value && typeof value === 'object' && !Array.isArray(value)
            ? changedFields(record(before[key]), record(value))
            : value,
        ],
      ]
    })
  )
}
export function MoStateSettings() {
  const { data } = useProduct()
  const runtime = useResource('runtime'),
    contract = useResource('state-contract'),
    status = useResource('state-runtime')
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null),
    [content, setContent] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [failure, setFailure] = useState('')
  const root = runtime.value ? record(runtime.value) : null
  const current = root ? record(record(root.settings).mo_state) : null
  const fields = draft ?? current
  const resource = contract.value ? record(contract.value) : null
  const state = status.value ? record(status.value) : null
  const snapshot = state?.current_snapshot ? record(state.current_snapshot) : null
  useEffect(() => {
    setDraft(null)
    setNotice('')
    setFailure('')
  }, [data.spaceId])
  useEffect(() => {
    setContent(resource ? text(resource.content, 'content') : '')
  }, [contract.value])
  const update = (key: string, value: unknown) => setDraft({ ...fields, [key]: value })
  async function save(kind: 'settings' | 'inherit' | 'contract' | 'reset') {
    setBusy(true)
    setFailure('')
    setNotice('')
    try {
      if (kind === 'settings' || kind === 'inherit') {
        await api('/api/resources', {
          spaceId: data.spaceId,
          command: 'runtime-save',
          revision: root?.revision,
          patch: {
            mo_state:
              kind === 'inherit'
                ? Object.fromEntries(
                    Object.keys(current ?? {})
                      .filter((key) => key !== 'memory_lifecycle')
                      .map((key) => [key, null])
                  )
                : changedFields(current ?? {}, fields ?? {}),
          },
        })
        setDraft(null)
        runtime.reload()
        status.reload()
      } else {
        await api('/api/resources', {
          spaceId: data.spaceId,
          command: kind === 'reset' ? 'state-contract-reset' : 'state-contract-save',
          revision: resource?.revision,
          content,
        })
        contract.reload()
        status.reload()
      }
      setNotice('已保存，下次对话使用新的配置。')
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack p="md" gap="lg" maw={800}>
      <Title order={5}>MO State</Title>
      <Text size="sm" c="dimmed">
        协调当前场景、记忆与语义网，生成参与对话的状态上下文。配置作用于当前个人空间。
      </Text>
      {(failure || runtime.error || contract.error || status.error) && (
        <Alert color="red">{failure || runtime.error || contract.error || status.error}</Alert>
      )}
      {notice && <Alert color="green">{notice}</Alert>}
      {fields ? (
        <>
          <Select
            label="状态配置档"
            description={fields.profile === 'v1_projection' ? '将记忆、语义网与场景/人物信号投影为状态上下文；V1 是 Core 的投影版本，不启用闭环维护与持久快照管理。' : '恢复到期维护，记录状态事件与版本并保存快照，再将状态用于对话；不会保证模型回复始终逻辑自洽。'}
            data={[
              { value: 'closed_autonomous', label: '闭环自治' },
              { value: 'v1_projection', label: 'V1 状态投影' },
            ]}
            value={String(fields.profile)}
            onChange={(v) => update('profile', v)}
          />
          <Select
            label="状态注入"
            data={[
              { value: 'active', label: '参与对话上下文' },
              { value: 'shadow', label: '仅观察（不注入上下文）' },
            ]}
            value={String(fields.injection_mode)}
            onChange={(v) => update('injection_mode', v)}
          />
          <Switch
            label="场景管理"
            checked={fields.scene_management === true}
            onChange={(e) => update('scene_management', e.currentTarget.checked)}
          />
          <Switch
            label="DDM 角色侧写"
            description="启用角色侧写生成与状态投影。"
            checked={record(fields.ddm).enabled === true}
            onChange={(e) => update('ddm', { ...record(fields.ddm), enabled: e.currentTarget.checked })}
          />
          <Flex gap="sm" wrap="wrap">
            {(
              [
                ['max_reconcile_steps', '最大协调步数', 1, 16],
                ['max_agent_steps', '最大代理步数', 1, 32],
                ['operation_timeout_ms', '操作超时（毫秒）', 1000, 300000],
              ] as const
            ).map(([key, label, min, max]) => (
              <NumberInput
                key={key}
                flex={1}
                miw={150}
                label={label}
                min={min}
                max={max}
                allowDecimal={false}
                value={Number(fields[key])}
                onChange={(v) => {
                  if (typeof v === 'number') update(key, v)
                }}
              />
            ))}
          </Flex>
          <Text size="xs" c="dimmed">
            配置修订：{String(root?.revision)} ·{' '}
            {root?.sources &&
            Object.entries(record(root.sources)).some(
              ([key, source]) => key.startsWith('mo_state.') && source === 'space_override'
            )
              ? '包含当前个人空间覆盖'
              : '继承实例默认设置'}
          </Text>
          <Flex gap="sm">
            <Button loading={busy} onClick={() => void save('settings')}>
              保存 MO State 配置
            </Button>
            <Button variant="subtle" disabled={busy} onClick={() => void save('inherit')}>
              继承默认配置
            </Button>
          </Flex>
        </>
      ) : (
        <Text c="dimmed">正在读取 MO State…</Text>
      )}
      <Divider label="当前运行状态" />
      {state && (
        <>
          <Flex justify="space-between">
            <Text size="sm">
              {state.status === 'not_initialized' ? '尚未生成状态快照' : state.degraded ? '降级运行' : '状态可用'}
            </Text>
            <Button size="xs" variant="subtle" onClick={status.reload}>
              刷新状态
            </Button>
          </Flex>
          {snapshot && (
            <>
              <Text size="xs" c="dimmed">
                快照 {String(state.snapshot_revision)} · 记忆 {String(state.dmw_revision)} · NSG{' '}
                {String(state.nsg_revision)} · 场景 {String(state.scene_revision)}
              </Text>
              <Textarea
                label="最近一次状态上下文"
                readOnly
                autosize
                minRows={3}
                maxRows={12}
                value={String(snapshot.state_context ?? '')}
              />
            </>
          )}
          {typeof state.last_error === 'string' && <Alert color="orange">{state.last_error}</Alert>}
        </>
      )}
      <Divider label="状态契约" />
      <Text size="sm" c="dimmed">
        定义状态维度及编译规则，Core 会验证契约格式。
        {resource?.source === 'builtin' ? '当前使用内置契约。' : '当前使用空间自定义契约。'}
      </Text>
      <Textarea
        label="状态契约（YAML）"
        autosize
        minRows={10}
        maxRows={22}
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        styles={{ input: { fontFamily: 'monospace' } }}
      />
      <Flex gap="sm">
        <Button disabled={!resource || !content.trim()} loading={busy} onClick={() => void save('contract')}>
          保存状态契约
        </Button>
        <Button disabled={!resource || busy} variant="subtle" onClick={() => void save('reset')}>
          恢复内置契约
        </Button>
      </Flex>
    </Stack>
  )
}
