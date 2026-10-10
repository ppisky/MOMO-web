import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Flex,
  MultiSelect,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
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
import {
  emptyExportSelection,
  chooseGroup,
  selectionState,
  changeQuickRange,
  type ExportGroup,
  type SelectionState,
  type ExportModule,
} from '../../features/moc/selection'

const moduleNames = { conversations: '对话（包含消息历史）', memory: '记忆', semantic_graph: '语义网' } as const
const stateNames = { none: '否', partial: '部分', all: '是' } as const

function ExportChoice({
  id,
  title,
  description,
  state,
  expanded,
  disabled,
  onToggle,
  onExpand,
  children,
}: {
  id: ExportGroup
  title: string
  description: string
  state: SelectionState
  expanded: boolean
  disabled: boolean
  onToggle: (enabled: boolean) => void
  onExpand: () => void
  children: ReactNode
}) {
  return (
    <Paper withBorder p="xs" radius="md">
      <Flex justify="space-between" align="center" gap="sm">
        <Stack gap={4} flex={1}>
          <Checkbox
            label={title}
            checked={state === 'all'}
            indeterminate={state === 'partial'}
            disabled={disabled}
            onChange={(e) => onToggle(e.currentTarget.checked)}
          />
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Stack>
        <Badge variant="light" color={state === 'none' ? 'gray' : 'chatbox-brand'}>
          {stateNames[state]}
        </Badge>
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={disabled}
          aria-label={`${title}细选`}
          aria-expanded={expanded}
          aria-controls={`moc-${id}-details`}
          onClick={onExpand}
        >
          {expanded ? '收起' : '细选'}
        </Button>
      </Flex>
      <Collapse in={expanded}>
        <Stack pt="md" gap="md" id={`moc-${id}-details`}>
          {children}
        </Stack>
      </Collapse>
    </Paper>
  )
}

export function MocExport() {
  const { data } = useProduct()
  const preferences = useSettingsStore((s) => s)
  const [selection, setSelection] = useState(emptyExportSelection)
  const { characterSpaces, allRoles, selectedRoles, scopes, configuration } = selection
  const [roles, setRoles] = useState<Character[]>([])
  const [rangeMode, setRangeMode] = useState('current')
  const [customRange, setCustomRange] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Record<ExportGroup, boolean>>({
    characters: false,
    conversations: false,
    assets: false,
    configuration: false,
  })
  const [fullSummary, setFullSummary] = useState(false)
  const [compatibility, setCompatibility] = useState('none')
  const [encrypted, setEncrypted] = useState(false),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false)
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const choices = data.spaces.spaces.map((s) => ({ value: s.id, label: s.name }))
  const range =
    rangeMode === 'current'
      ? [data.spaceId]
      : rangeMode === 'all'
        ? choices.map((s) => s.value)
        : customRange.filter((id) => choices.some((s) => s.value === id))
  const rangeKey = range.join(',')
  const previousRange = useRef(range)
  useEffect(() => {
    const next = rangeKey ? rangeKey.split(',') : []
    const previous = previousRange.current
    setSelection((value) => changeQuickRange(value, previous, next))
    previousRange.current = next
  }, [rangeKey])

  useEffect(() => {
    const abort = new AbortController()
    setRoles([])
    setError('')
    setLoading(!!characterSpaces.length)
    void Promise.all(
      characterSpaces.map((id) =>
        api(`/api/workspace?space=${id}`, undefined, abort.signal).then((v) => list(record(v).characters, character))
      )
    )
      .then((values) => {
        if (abort.signal.aborted) return
        const available = values.flat()
        setRoles(available)
        setSelection((value) => ({
          ...value,
          selectedRoles: value.selectedRoles.filter((id) => available.some((r) => r.id === id)),
        }))
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [characterSpaces])

  const setCharacterSpaces = (value: string[]) =>
    setSelection((s) => ({ ...s, characterSpaces: value, selectedRoles: [] }))
  const setScope = (key: ExportModule, value: string[]) =>
    setSelection((s) => ({ ...s, scopes: { ...s.scopes, [key]: value } }))
  const setConfiguration = (value: ConfigurationSelection) => setSelection((s) => ({ ...s, configuration: value }))
  const spaceNames = (ids: string[]) => ids.map((id) => choices.find((s) => s.value === id)?.label ?? id).join('、')
  const selected =
    characterSpaces.length +
    Object.values(scopes).reduce((sum, v) => sum + v.length, 0) +
    configurationCount(configuration)
  const selectedSpaceConfigs = Object.values(configuration.spaces).reduce((sum, ids) => sum + (ids?.length ?? 0), 0)
  const configSpaces = [
    ...new Set([...configuration.personal_spaces, ...Object.values(configuration.spaces).flatMap((ids) => ids ?? [])]),
  ]
  const choice = (id: ExportGroup) => ({
    id,
    state: selectionState(selection, id, range),
    expanded: expanded[id],
    disabled: busy,
    onToggle: (enabled: boolean) => setSelection((s) => chooseGroup(s, id, enabled, range)),
    onExpand: () => setExpanded((s) => ({ ...s, [id]: !s[id] })),
  })

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
      const url = URL.createObjectURL(await response.blob())
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

  const spaceSelector = (key: ExportModule) => (
    <MultiSelect
      label={moduleNames[key]}
      placeholder={`不导出${moduleNames[key]}`}
      data={choices}
      value={scopes[key]}
      onChange={(value) => setScope(key, value)}
      disabled={busy}
    />
  )
  return (
    <Stack p="md" gap="sm" maw={800}>
      <Title order={5}>导出 MOC</Title>
      <Text size="sm" c="dimmed">
        先选范围，再决定带哪些内容。需要时展开细选。
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {notice && <Alert color="green">{notice}</Alert>}
      <Select
        label="快速范围"
        value={rangeMode}
        disabled={busy}
        allowDeselect={false}
        data={[
          { value: 'current', label: `当前个人空间 · ${spaceNames([data.spaceId])}` },
          { value: 'all', label: '全部个人空间' },
          { value: 'custom', label: '自行选择个人空间' },
        ]}
        onChange={(value) => {
          if (!value) return
          if (value === 'custom' && !customRange.length) setCustomRange(range)
          setRangeMode(value)
        }}
      />
      {rangeMode === 'custom' && (
        <MultiSelect
          label="选择个人空间"
          data={choices}
          value={customRange}
          onChange={setCustomRange}
          disabled={busy}
        />
      )}
      <Text size="xs" c="dimmed">
        切换范围会更新已选项目的个人空间；细选可分别调整。全局配置不受此范围限制。
      </Text>

      <ExportChoice {...choice('characters')} title="带角色" description="角色卡与人物设定">
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
              disabled={busy}
              onChange={(e) => {
                const checked = e.currentTarget.checked
                setSelection((s) => ({ ...s, allRoles: checked, selectedRoles: [] }))
              }}
            />
            {!allRoles && (
              <MultiSelect
                label="具体角色"
                searchable
                placeholder={loading ? '正在载入角色…' : '选择要导出的角色'}
                disabled={busy || loading}
                value={selectedRoles}
                data={roles.map((r) => ({ value: r.id, label: `${r.name} · ${spaceNames([r.owner_space_id])}` }))}
                onChange={(value) => setSelection((s) => ({ ...s, selectedRoles: value }))}
              />
            )}
            <Select
              label="附加角色卡兼容格式"
              description="MOC 原生角色数据始终保留。"
              value={compatibility}
              data={[
                { value: 'none', label: '仅 MOC 原生数据' },
                { value: 'preserved_source', label: '附带保留的原始角色卡' },
                { value: 'generated_ccv2_json', label: '生成 CCv2 JSON' },
                { value: 'generated_ccv3_json', label: '生成 CCv3 JSON' },
                { value: 'generated_ccv3_charx', label: '生成 CCv3 CHARX' },
              ]}
              onChange={(v) => setCompatibility(v ?? 'none')}
              disabled={busy}
            />
          </>
        )}
      </ExportChoice>
      <ExportChoice {...choice('conversations')} title="带对话" description="对话和消息历史">
        {spaceSelector('conversations')}
      </ExportChoice>
      <ExportChoice {...choice('assets')} title="带记忆与语义网" description="已有记忆和语义网资产">
        {spaceSelector('memory')}
        {spaceSelector('semantic_graph')}
      </ExportChoice>
      <ExportChoice
        {...choice('configuration')}
        title="带使用配置"
        description="模型、参数、提示词、个人空间策略与界面偏好"
      >
        <Divider label="全局配置 · 不受个人空间范围限制" />
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
          label="提示词空间（全局）"
          placeholder="选择要导出的提示词"
          data={Object.entries(promptChoices).map(([value, label]) => ({ value, label }))}
          value={configuration.prompts}
          disabled={busy}
          onChange={(prompts) => setConfiguration({ ...configuration, prompts })}
        />
        <Divider label="个人空间配置" />
        <MultiSelect
          label="个人空间目录"
          placeholder="不导出目录"
          data={choices}
          value={configuration.personal_spaces}
          disabled={busy}
          onChange={(personal_spaces) => setConfiguration({ ...configuration, personal_spaces })}
        />
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
          模型密钥与本机图片文件不导出。配置会作为快照保存，配置恢复尚未接入。
        </Text>
      </ExportChoice>

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

      <Box pos="sticky" bottom={0} pt="xs" style={{ background: 'var(--chatbox-background-primary)', zIndex: 1 }}>
        <Paper
          withBorder
          p="sm"
          radius="md"
          bg="var(--chatbox-background-primary)"
          role="region"
          aria-label="本次导出范围"
        >
          <Stack gap="xs">
            <Flex justify="space-between" align="center" gap="sm">
              <Title order={6}>本次导出范围</Title>
              {!!selected && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  aria-expanded={fullSummary}
                  onClick={() => setFullSummary((v) => !v)}
                >
                  {fullSummary ? '收起清单' : '查看完整清单'}
                </Button>
              )}
            </Flex>
            {!selected && (
              <Text size="sm" c="dimmed">
                尚未选择导出内容。
              </Text>
            )}
            {!!characterSpaces.length && (
              <Text size="sm">
                角色：{spaceNames(characterSpaces)} · {allRoles ? '全部角色' : `${selectedRoles.length} 个角色`}
              </Text>
            )}
            {!!scopes.conversations.length && <Text size="sm">对话：{spaceNames(scopes.conversations)}</Text>}
            {!!scopes.memory.length && <Text size="sm">记忆：{spaceNames(scopes.memory)}</Text>}
            {!!scopes.semantic_graph.length && <Text size="sm">语义网：{spaceNames(scopes.semantic_graph)}</Text>}
            {!!configurationCount(configuration) && (
              <Text size="sm">
                使用配置：全局 {configuration.global.length} 项 · 提示词 {configuration.prompts.length} 个 · 目录{' '}
                {configuration.personal_spaces.length} 个 · 空间配置 {selectedSpaceConfigs} 项
                {!!configSpaces.length && `（${spaceNames(configSpaces)}）`}
              </Text>
            )}
            <Collapse in={fullSummary}>
              <Stack gap={4} mah={190} style={{ overflow: 'auto' }}>
                {!!characterSpaces.length && !allRoles && (
                  <Text size="xs">
                    具体角色：
                    {roles
                      .filter((r) => selectedRoles.includes(r.id))
                      .map((r) => r.name)
                      .join('、') || '尚未选择'}
                  </Text>
                )}
                {!!characterSpaces.length && (
                  <Text size="xs">角色兼容格式：{compatibility === 'none' ? '仅 MOC 原生数据' : compatibility}</Text>
                )}
                {!!configuration.global.length && (
                  <Text size="xs">
                    全局配置：{configuration.global.map((key) => globalConfigNames[key]).join('、')}
                  </Text>
                )}
                {!!configuration.personal_spaces.length && (
                  <Text size="xs">个人空间目录：{spaceNames(configuration.personal_spaces)}</Text>
                )}
                {!!configuration.prompts.length && (
                  <Text size="xs">
                    全局提示词：
                    {configuration.prompts.map((id) => promptChoices[id as keyof typeof promptChoices]).join('、')}
                  </Text>
                )}
                {(Object.entries(spaceConfigNames) as [SpaceConfig, string][])
                  .filter(([key]) => configuration.spaces[key]?.length)
                  .map(([key, label]) => (
                    <Text size="xs" key={key}>
                      {label}：{spaceNames(configuration.spaces[key] ?? [])}
                    </Text>
                  ))}
              </Stack>
            </Collapse>
            <Flex justify="space-between" align="center" gap="sm" wrap="wrap">
              <Text size="xs" c="dimmed">
                {encrypted ? '密码加密' : '未加密'} · 未选择的内容不会导出
              </Text>
              <Button
                loading={busy}
                disabled={!selected || loading || (!allRoles && !!characterSpaces.length && !selectedRoles.length)}
                onClick={() => void download()}
              >
                生成并下载 MOC
              </Button>
            </Flex>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  )
}
