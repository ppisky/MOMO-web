import React, { useEffect, useState } from 'react'
import { Alert, Button, Divider, Flex, NumberInput, Stack, Switch, Text, Title } from '@mantine/core'
import { record } from '../../contracts/core'
import { useProduct } from './context'
import { api } from './api'
import { useResource } from './CoreSettings'
export function MemorySettings() {
  const { data } = useProduct()
  const { value, error, reload } = useResource('runtime')
  const root = value ? record(value) : null
  const settings = root ? record(root.settings) : null
  const current = settings ? record(settings.runtime) : null
  const lifecycle = settings ? record(record(settings.mo_state).memory_lifecycle) : null
  const [maintenanceDraft, setMaintenanceDraft] = useState<Record<string, boolean | number>>({})
  const [lifecycleDraft, setLifecycleDraft] = useState<Record<string, boolean | number>>({})
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState('')
  useEffect(() => {
    setMaintenanceDraft({})
    setLifecycleDraft({})
    setFailure('')
    setNotice('')
  }, [data.spaceId])
  const fields = { ...current, ...maintenanceDraft },
    life = { ...lifecycle, ...lifecycleDraft }
  const update = (key: string, value: boolean | number) => setMaintenanceDraft((v) => ({ ...v, [key]: value }))
  const age = (key: string, value: boolean | number) => setLifecycleDraft((v) => ({ ...v, [key]: value }))
  async function save(reset = false) {
    if (!root || !current || !lifecycle) return
    setBusy(true)
    setFailure('')
    setNotice('')
    try {
      await api('/api/resources', {
        spaceId: data.spaceId,
        command: 'runtime-save',
        revision: root.revision,
        patch: {
          runtime: reset ? Object.fromEntries(Object.keys(current).map((k) => [k, null])) : maintenanceDraft,
          mo_state: { memory_lifecycle: reset ? null : lifecycleDraft },
        },
      })
      setMaintenanceDraft({})
      setLifecycleDraft({})
      reload()
      setNotice(reset ? '已恢复继承记忆与语义网策略。' : '已保存，后续对话按新的策略维护资产。')
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }
  if (error) return <Alert color="red">{error}</Alert>
  return (
    <Stack gap="md" maw={760}>
      <Title order={5}>记忆与语义网</Title>
      <Text size="sm" c="dimmed">
        配置当前个人空间的自动维护和记忆生命周期。来源归属、注入范围与内容在各资产页面配置。
      </Text>
      {failure && <Alert color="red">{failure}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      {current && lifecycle ? (
        <>
          <Divider label="自动维护" />
          <Switch
            label="自动提取记忆"
            checked={fields.memory_distillation_enabled === true}
            disabled={busy}
            onChange={(e) => update('memory_distillation_enabled', e.currentTarget.checked)}
          />
          <NumberInput
            label="记忆提取间隔（轮）"
            min={1}
            max={200}
            allowDecimal={false}
            value={Number(fields.memory_distill_every_turns)}
            onChange={(v) => {
              if (typeof v === 'number') update('memory_distill_every_turns', v)
            }}
            disabled={busy}
          />
          <Switch
            label="自动维护语义网"
            checked={fields.semantic_graph_enabled === true}
            disabled={busy}
            onChange={(e) => update('semantic_graph_enabled', e.currentTarget.checked)}
          />
          <NumberInput
            label="语义网维护间隔（轮）"
            min={1}
            max={200}
            allowDecimal={false}
            value={Number(fields.nsg_govern_every_turns)}
            onChange={(v) => {
              if (typeof v === 'number') update('nsg_govern_every_turns', v)
            }}
            disabled={busy}
          />
          <Divider label="记忆生命周期" />
          <Text size="xs" c="dimmed">
            按相关对话的活动轮数计算。关闭自动提取或衰减不会删除已有资产。
          </Text>
          <Switch
            label="记忆衰减"
            checked={life.enabled === true}
            onChange={(e) => age('enabled', e.currentTarget.checked)}
            disabled={busy}
          />
          <Flex gap="sm">
            <NumberInput
              flex={1}
              label="衰减间隔（轮）"
              min={1}
              max={1000000}
              allowDecimal={false}
              value={Number(life.decay_after_turns)}
              disabled={busy}
              onChange={(v) => {
                if (typeof v === 'number') age('decay_after_turns', v)
              }}
            />
            <NumberInput
              flex={1}
              label="衰减系数"
              min={0.000001}
              max={0.999999}
              decimalScale={6}
              step={0.05}
              value={Number(life.decay_factor)}
              disabled={busy}
              onChange={(v) => {
                if (typeof v === 'number') age('decay_factor', v)
              }}
            />
          </Flex>
          <Switch
            label="自动遗忘"
            description="达到条件后由 Core 移除已归档记忆；受保护资产按 Core 规则保留。"
            checked={life.auto_forget === true}
            onChange={(e) => age('auto_forget', e.currentTarget.checked)}
            disabled={busy}
          />
          <NumberInput
            label="遗忘间隔（轮）"
            min={1}
            max={1000000}
            allowDecimal={false}
            value={Number(life.forget_after_turns)}
            disabled={busy}
            onChange={(v) => {
              if (typeof v === 'number') age('forget_after_turns', v)
            }}
          />
          <Text size="xs" c="dimmed">
            配置修订：{String(root?.revision)}。未修改的字段继续继承；恢复继承只清除本页维护的策略。
          </Text>
          <Flex justify="flex-end" gap="xs">
            <Button variant="subtle" disabled={busy} onClick={() => void save(true)}>
              恢复继承
            </Button>
            <Button
              loading={busy}
              disabled={!Object.keys(maintenanceDraft).length && !Object.keys(lifecycleDraft).length}
              onClick={() => void save()}
            >
              保存
            </Button>
          </Flex>
        </>
      ) : (
        <Text c="dimmed">正在读取配置…</Text>
      )}
      <Text size="xs" c="dimmed">
        提示词在通用设置统一管理。内容、注入范围与关系在记忆和语义网资产页面配置；状态协调与状态契约在 MO State。
      </Text>
    </Stack>
  )
}
