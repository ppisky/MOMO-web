import React, { useEffect, useRef, useState } from 'react'
import { Alert, Textarea } from '@mantine/core'
import { groupFromJson, parameterJson, type ParameterGroup } from '../../contracts/parameters'
export function RequestParameterJson({
  group,
  onChange,
  onError,
}: {
  group: ParameterGroup
  onChange: (group: ParameterGroup) => void
  onError: (error: string) => void
}) {
  const source = JSON.stringify(parameterJson(group), null, 2)
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
  }, [source])
  return (
    <>
      <Textarea
        label="请求参数 JSON"
        description="直接修改温度、top_p、max_output_tokens 或供应商参数。删除字段表示未设置；额外参数需获当前个人空间策略允许。"
        value={draft}
        autosize
        minRows={5}
        maxRows={18}
        spellCheck={false}
        styles={{ input: { fontFamily: 'monospace' } }}
        onChange={(e) => {
          const next = e.currentTarget.value
          setDraft(next)
          try {
            const value = groupFromJson(group, JSON.parse(next))
            applied.current = JSON.stringify(parameterJson(value), null, 2)
            setFailure('')
            onError('')
            onChange(value)
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
