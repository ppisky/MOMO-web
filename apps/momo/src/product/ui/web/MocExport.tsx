import React, { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Divider, MultiSelect, PasswordInput, Select, Stack, Text, Title } from '@mantine/core'
import { character, list, record, type Character } from '../../contracts/core'
import { useProduct } from './context'
import { api } from './api'
const moduleNames = { conversations: '对话（包含消息历史）', memory: '记忆', semantic_graph: '语义网' } as const
type Module = keyof typeof moduleNames
export function MocExport() {
  const { data } = useProduct()
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
  const selected = characterSpaces.length + Object.values(scopes).reduce((sum, v) => sum + v.length, 0)
  async function download() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (encrypted && (!password || password !== confirm)) throw Error('请填写一致的加密口令')
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
        按模块选择导出范围。角色可以精确选择；对话、记忆与语义网分别按空间导出，彼此独立。
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      <MultiSelect
        label="角色所在空间"
        placeholder="不导出角色"
        data={choices}
        value={characterSpaces}
        onChange={setCharacterSpaces}
        disabled={busy}
      />
      {!!characterSpaces.length && (
        <>
          <Checkbox
            label="导出选中空间的全部角色"
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
      <Text size="xs" c="dimmed">
        API 密钥、模型服务商凭据、运行策略和提示词设置不在此导出范围内。
      </Text>
      <Divider label="文件保护" />
      <Checkbox
        label="使用口令加密 MOC"
        checked={encrypted}
        onChange={(e) => setEncrypted(e.currentTarget.checked)}
        disabled={busy}
      />
      {encrypted && (
        <>
          <PasswordInput
            label="加密口令"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            disabled={busy}
          />
          <PasswordInput
            label="确认口令"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            disabled={busy}
          />
          <Text size="xs" c="dimmed">
            口令不会保存在应用设置中，导入时需要此口令。
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
