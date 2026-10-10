import { useEffect, useRef, useState } from 'react'
import { Alert, Textarea } from '@mantine/core'
import { requestFromJson, requestParameterJson, type ParameterGroup } from '../../contracts/parameters'
export function RequestParameterJson({
  group,
  stream,
  onStreamChange,
  onChange,
  onError,
}: {
  group: ParameterGroup
  stream: boolean
  onStreamChange: (stream: boolean) => void
  onChange: (group: ParameterGroup) => void
  onError: (error: string) => void
}) {
  const source = JSON.stringify(requestParameterJson(group, stream), null, 2)
  const [draft, setDraft] = useState(source),
    [failure, setFailure] = useState('')
  const applied = useRef('')
  useEffect(() => {
    if (applied.current !== source) {
      setDraft(source)
      setFailure('')
      onError('')
      applied.current = source
    }
  }, [source, onError])
  return (
    <>
      <Textarea
        label="对话请求参数 JSON"
        description="仅用于对话请求，不用于视觉回退、记忆提取、语义网整理或向量化。stream 与流式开关同步；温度、top_p、max_output_tokens 删除后跟随模型，删除 stream 保留当前开关。额外参数需获个人空间策略允许。"
        value={draft}
        autosize
        minRows={5}
        maxRows={18}
        spellCheck={false}
        styles={{ input: { fontFamily: 'monospace' } }}
        onBlur={() => {
          if (!failure) setDraft(source)
        }}
        onChange={(e) => {
          const next = e.currentTarget.value
          setDraft(next)
          try {
            const value = requestFromJson(group, stream, JSON.parse(next))
            applied.current = JSON.stringify(requestParameterJson(value.group, value.stream), null, 2)
            setFailure('')
            onError('')
            onChange(value.group)
            onStreamChange(value.stream)
          } catch (error) {
            const message =
              error instanceof SyntaxError
                ? 'JSON 格式不完整或有误，修正后才能保存。'
                : error instanceof Error
                  ? error.message
                  : '无效请求参数'
            setFailure(message)
            onError(message)
          }
        }}
      />
      {failure && <Alert color="red">{failure}</Alert>}
    </>
  )
}
