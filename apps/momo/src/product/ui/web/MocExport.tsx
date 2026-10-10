import React, { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Divider, MultiSelect, PasswordInput, Select, Stack, Text, Title } from '@mantine/core'
import { character, list, record, type Character } from '../../contracts/core'
import { useProduct } from './context'
import { api } from './api'
import { useSettingsStore } from './store'
import {
  configurationCount,
  globalConfigNames,
  spaceConfigNames,
  promptChoices,
  type ConfigurationSelection,
  type SpaceConfig,
  type GlobalConfig,
} from '../../contracts/moc'
const moduleNames = { conversations: '对话（包含消息历史）', memory: '记忆', semantic_graph: '语义网' } as const
type Module = keyof typeof moduleNames
export function MocExport() {
  const { data } = useProduct()
  const preferences = useSettingsStore((s) => s)
  const [configuration, setConfiguration] = useState<ConfigurationSelection>({
    global: [],
    prompts: [],
    personal_spaces: [],
    spaces: {},
  })
  const [characterSpaces, setCharacterSpaces] = useState<string[]>([]),
    [allRoles, setAllRoles] = useState(true),
    [selectedRoles, setSelectedRoles] = useState<string[]>([]),
    [roles, setRoles] = useState<Character[]>([])
  const [scopes, setScopes] = useState<Record<Module, string[]>>({ conversations: [], memory: [], semantic_graph: [] })
  const [compatibility, setCompatibility] = useState('none'),
    [encrypted, setEncrypted] = useState(false),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const choices = data.spaces.spaces.map((s) => ({ value: s.id, label: s.name }))
  useEffect(() => {
    const abort = new AbortController()
    setRoles([])
    setSelectedRoles([])
    setError('')
    setLoading(true)
    void Promise.all(
      characterSpaces.map((id) =>
        api(`/api/workspace?space=${id}`, undefined, abort.signal).then((v) => list(record(v).characters, character))
      )
    )
      .then((values) => setRoles(values.flat()))
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [characterSpaces])
  const selected =
    characterSpaces.length +
    Object.values(scopes).reduce((sum, v) => sum + v.length, 0) +
    configurationCount(configuration)
  async function download() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (encrypted && (!password || password !== confirm)) throw Error('请填写一致的加密密码')
      const selections = characterSpaces.map((space_id) => ({
        space_id,
        character_ids: allRoles
          ? []
          : selectedRoles.filter((id) => roles.some((r) => r.id === id && r.owner_space_id === space_id)),
      }))
      if (!allRoles && selections.some((s) => !s.character_ids.length))
        throw Error('每个选中的角色空间至少选择一个角色；空选不会导出全部角色')
      const response = await fetch('/api/moc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: { characters: selections, ...scopes, compatibility: selections.length ? compatibility : 'none' },
          protection: encrypted ? { type: 'passphrase', value: password } : { type: 'none' },
          configuration,
          ...(configuration.global.includes('preferences')
            ? { preferences: Object.fromEntries(Object.entries(preferences).filter(([key]) => key !== 'setSettings')) }
            : {}),
        }),
      })
      if (!response.ok) {
        const body = record(await response.json())
        throw Error(String(body.error ?? '导出失败'))
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `MOMO-${new Date().toISOString().slice(0, 10)}.moc`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      setPassword('')
      setConfirm('')
      setNotice('MOC 文件已生成，浏览器已开始下载。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack p="md" gap="lg" maw={800}>
      <Title order={5}>导出 MOC</Title>
      <Text size="sm" c="dimmed">
        选择业务资产与配置组件。角色可以精确选择；对话、记忆与语义网按个人空间导出，配置独立勾选。
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      <MultiSelect
        label="角色所在个人空间"
        placeholder="不导出角色"
        data={choices}
        value={characterSpaces}
        onChange={setCharacterSpaces}
        disabled={busy}
      />
      {!!characterSpaces.length && (
        <>
          <Checkbox
            label="导出选中个人空间的全部角色"
            checked={allRoles}
            onChange={(e) => setAllRoles(e.currentTarget.checked)}
            disabled={busy}
          />
          {!allRoles && (
            <MultiSelect
              label="具体角色"
              searchable
              placeholder={loading ? '正在载入角色…' : '选择要导出的角色'}
              disabled={busy || loading}
              data={roles.map((r) => ({
                value: r.id,
                label: `${r.name} · ${data.spaces.spaces.find((s) => s.id === r.owner_space_id)?.name}`,
              }))}
              value={selectedRoles}
              onChange={setSelectedRoles}
            />
          )}
          <Select
            label="附加角色卡兼容格式"
            description="MOC 原生角色数据始终保留。"
            data={[
              { value: 'none', label: '仅 MOC 原生数据' },
              { value: 'preserved_source', label: '附带保留的原始角色卡' },
              { value: 'generated_ccv2_json', label: '生成 CCv2 JSON' },
              { value: 'generated_ccv3_json', label: '生成 CCv3 JSON' },
              { value: 'generated_ccv3_charx', label: '生成 CCv3 CHARX' },
            ]}
            value={compatibility}
            onChange={(v) => setCompatibility(v ?? 'none')}
            disabled={busy}
          />
        </>
      )}
      <Divider />
      {(Object.entries(moduleNames) as [Module, string][]).map(([key, label]) => (
        <MultiSelect
          key={key}
          label={label}
          placeholder={`不导出${label}`}
          data={choices}
          value={scopes[key]}
          onChange={(value) => setScopes({ ...scopes, [key]: value })}
          disabled={busy}
        />
      ))}
      <Divider label="应用配置" />
      {(Object.entries(globalConfigNames) as [GlobalConfig, string][]).map(([key, label]) => (
        <Checkbox
          key={key}
          label={label}
          checked={configuration.global.includes(key)}
          disabled={busy}
          onChange={(e) =>
            setConfiguration({
              ...configuration,
              global: e.currentTarget.checked
                ? [...configuration.global, key]
                : configuration.global.filter((v) => v !== key),
            })
          }
        />
      ))}
      <MultiSelect
        label="个人空间目录"
        placeholder="不导出目录"
        data={choices}
        value={configuration.personal_spaces}
        disabled={busy}
        onChange={(personal_spaces) => setConfiguration({ ...configuration, personal_spaces })}
      />
      <MultiSelect
        label="提示词空间"
        placeholder="选择要导出的提示词"
        data={Object.entries(promptChoices).map(([value, label]) => ({ value, label }))}
        value={configuration.prompts}
        disabled={busy}
        onChange={(prompts) => setConfiguration({ ...configuration, prompts })}
      />
      <Divider label="各个人空间的配置" />
      {(Object.entries(spaceConfigNames) as [SpaceConfig, string][]).map(([key, label]) => (
        <MultiSelect
          key={key}
          label={label}
          data={choices}
          placeholder={`不导出${label}`}
          value={configuration.spaces[key] ?? []}
          disabled={busy}
          onChange={(value) =>
            setConfiguration({ ...configuration, spaces: { ...configuration.spaces, [key]: value } })
          }
        />
      ))}
      <Text size="xs" c="dimmed">
        配置以 MOC 扩展模块保存。服务商密钥不导出；界面偏好不包含本机图片文件。这里只导出配置快照，导入恢复由应用处理。
      </Text>
      <Divider label="文件保护" />
      <Checkbox
        label="使用密码加密 MOC"
        checked={encrypted}
        onChange={(e) => setEncrypted(e.currentTarget.checked)}
        disabled={busy}
      />
      {encrypted && (
        <>
          <PasswordInput
            label="加密密码"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            disabled={busy}
          />
          <PasswordInput
            label="确认密码"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            disabled={busy}
          />
          <Text size="xs" c="dimmed">
            密码不会保存在应用设置中，导入时需要此密码。
          </Text>
        </>
      )}
      <Alert color="gray" title="本次导出范围">
        <Text size="sm">
          角色：
          {characterSpaces.length
            ? `${characterSpaces.map((id) => choices.find((s) => s.value === id)?.label).join('、')}（${
                allRoles ? '全部角色' : `${selectedRoles.length} 个角色`
              }）`
            : '不导出'}
        </Text>
        {(Object.entries(moduleNames) as [Module, string][]).map(([key, label]) => (
          <Text size="sm" key={key}>
            {label}：{scopes[key].map((id) => choices.find((s) => s.value === id)?.label).join('、') || '不导出'}
          </Text>
        ))}
        <Text size="sm">
          应用配置：{configuration.global.map((key) => globalConfigNames[key]).join('、') || '不导出'}
        </Text>
        <Text size="sm">
          个人空间目录：
          {configuration.personal_spaces.map((id) => choices.find((s) => s.value === id)?.label).join('、') || '不导出'}
        </Text>
        <Text size="sm">
          提示词：
          {configuration.prompts.map((id) => promptChoices[id as keyof typeof promptChoices]).join('、') || '不导出'}
        </Text>
        {(Object.entries(spaceConfigNames) as [SpaceConfig, string][])
          .filter(([key]) => configuration.spaces[key]?.length)
          .map(([key, label]) => (
            <Text size="sm" key={key}>
              {label}：{configuration.spaces[key]?.map((id) => choices.find((s) => s.value === id)?.label).join('、')}
            </Text>
          ))}
      </Alert>
      <Button
        loading={busy}
        disabled={!selected || loading || (!allRoles && !!characterSpaces.length && !selectedRoles.length)}
        onClick={() => void download()}
      >
        生成并下载 MOC
      </Button>
    </Stack>
  )
}
