import { Alert, Button, Collapse, Flex, Stack, Text, Textarea } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { embeddingParameters, purposeParameterJson } from '../../contracts/parameters'
import {
  type Purpose,
  type PurposeConfiguration,
  parameterDifference,
  purposeConfigurations,
} from '../../contracts/purpose-parameters'
import { api } from './api'

export function PurposeRequestJson({
  purpose,
  label,
  modelId,
  dimension,
  spaceId,
  value,
  onChange,
  onError,
}: {
  purpose: Purpose
  label: string
  modelId: string | null
  dimension?: number | null
  spaceId: string
  value?: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  onError: (message: string) => void
}) {
  const [expanded, setExpanded] = useState(false),
    [configuration, setConfiguration] = useState<PurposeConfiguration | null>(null)
  const [draft, setDraft] = useState(''),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false)
  const [policyVersion, setPolicyVersion] = useState(0)
  useEffect(() => {
    const reload = () => setPolicyVersion((v) => v + 1)
    window.addEventListener('momo-parameter-policy-changed', reload)
    return () => window.removeEventListener('momo-parameter-policy-changed', reload)
  }, [])
  const callbacks = useRef({ onChange, onError })
  callbacks.current = { onChange, onError }
  const configurationRef = useRef(configuration)
  configurationRef.current = configuration
  const source = JSON.stringify(value ?? {}),
    ready = !!modelId
  const appliedSource = useRef(''),
    editFailure = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: A policy revision explicitly revalidates an unchanged draft.
  useEffect(() => {
    if (!expanded || !ready) return
    const abort = new AbortController()
    setBusy(true)
    const timer = setTimeout(() => {
      void api(
        '/api/purpose-parameters',
        { spaceId, purpose, modelId, dimension, parameters: JSON.parse(source) },
        abort.signal
      )
        .then((input) => {
          const next = purposeConfigurations(input)[purpose]
          if (!next) throw Error('Core 未返回该用途配置')
          setConfiguration(next)
          if (!editFailure.current && appliedSource.current !== source) {
            setDraft(JSON.stringify({ ...next.defaults, ...JSON.parse(source) }, null, 2))
            appliedSource.current = source
          }
          if (!editFailure.current) {
            setFailure('')
            callbacks.current.onError('')
          }
        })
        .catch(async (error: unknown) => {
          if (!abort.signal.aborted) {
            const message = error instanceof Error ? error.message : '用途配置读取失败'
            setFailure(message)
            callbacks.current.onError(message)
            // A newly restrictive Space policy must not trap an existing override in an uneditable error.
            if (!configurationRef.current) {
              try {
                const fallback = purposeConfigurations(
                  await api(
                    '/api/purpose-parameters',
                    { spaceId, purpose, modelId, dimension, parameters: {} },
                    abort.signal
                  )
                )[purpose]
                if (fallback && !abort.signal.aborted) {
                  setConfiguration(fallback)
                  setDraft(JSON.stringify({ ...fallback.defaults, ...JSON.parse(source) }, null, 2))
                }
              } catch {
                /* Keep the original failure and an explicit reset action. */
              }
            }
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) setBusy(false)
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [expanded, ready, modelId, dimension, spaceId, purpose, source, policyVersion])
  useEffect(() => () => callbacks.current.onError(''), [])
  function reset() {
    editFailure.current = false
    appliedSource.current = ''
    setFailure('')
    callbacks.current.onError('')
    callbacks.current.onChange({})
    if (configuration) setDraft(JSON.stringify(configuration.defaults, null, 2))
  }
  return (
    <Stack gap="xs">
      <Flex justify="space-between" align="center" gap="sm">
        <Text size="xs" c="dimmed">
          {Object.keys(value ?? {}).length ? '已自定义' : '使用 Core 推荐配置'}
        </Text>
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={!ready}
          aria-expanded={expanded}
          aria-controls={`purpose-${purpose}-parameters`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '收起请求参数' : '调整请求参数'}
        </Button>
        {!ready && Object.keys(value ?? {}).length > 0 && (
          <Button variant="subtle" size="compact-sm" onClick={reset}>
            恢复默认
          </Button>
        )}
      </Flex>
      <Collapse in={expanded}>
        <Stack gap="xs" id={`purpose-${purpose}-parameters`}>
          {busy && (
            <Text size="xs" c="dimmed">
              正在校验 Core 用途配置…
            </Text>
          )}
          {configuration && (
            <>
              <Textarea
                label={
                  purpose === 'embedding' ? '语义网向量化请求参数 JSON' : `${label.replace(/模型$/, '')}请求参数 JSON`
                }
                description={
                  purpose === 'embedding'
                    ? '省略 dimensions 跟随模型默认；填写后同步向量维数，并要求模型支持。model 和 input 由 Core 填入，归一化与前缀不属于请求参数。'
                    : '未修改的字段使用 Core 推荐值；删除字段恢复继承。额外参数受当前个人空间策略约束，对话请求参数不进入这里。'
                }
                value={draft}
                autosize
                minRows={4}
                maxRows={16}
                spellCheck={false}
                styles={{ input: { fontFamily: 'monospace' } }}
                onChange={(event) => {
                  const next = event.currentTarget.value
                  setDraft(next)
                  try {
                    const parsed = (purpose === 'embedding' ? embeddingParameters : purposeParameterJson)(
                      JSON.parse(next)
                    )
                    const custom = parameterDifference(parsed, configuration.defaults)
                    editFailure.current = false
                    setFailure('')
                    callbacks.current.onError('')
                    appliedSource.current = JSON.stringify(custom)
                    callbacks.current.onChange(custom)
                  } catch (error) {
                    editFailure.current = true
                    const message =
                      error instanceof SyntaxError
                        ? 'JSON 格式不完整或有误，修正后才能保存。'
                        : error instanceof Error
                          ? error.message
                          : '无效参数'
                    setFailure(message)
                    callbacks.current.onError(message)
                  }
                }}
              />
              {configuration.ignored.length > 0 && (
                <Alert color="yellow">
                  当前个人空间忽略以下覆盖：{configuration.ignored.join('、')}。实际仍使用推荐值。
                </Alert>
              )}
              <Text size="xs" c="dimmed">
                实际生效：{JSON.stringify(configuration.effective)}
              </Text>
            </>
          )}
          <Button variant="light" size="xs" style={{ alignSelf: 'flex-start' }} onClick={reset}>
            恢复默认
          </Button>
          {failure && <Alert color="red">{failure}</Alert>}
        </Stack>
      </Collapse>
    </Stack>
  )
}
