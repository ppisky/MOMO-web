import { record } from './core'
import { purposeNames, purposeParameterJson, embeddingParameters, type ModelPurpose } from './parameters'
export type Purpose = ModelPurpose | 'embedding'
export type PurposeConfiguration = {
  defaults: Record<string, unknown>
  effective: Record<string, unknown>
  overrides: Record<string, unknown>
  constraints: Record<string, unknown>
  ignored: string[]
}
export function purposeConfigurations(input: unknown): Partial<Record<Purpose, PurposeConfiguration>> {
  const raw = record(input)
  if (raw.version !== 1) throw Error('Core 用途请求配置版本不兼容')
  return Object.fromEntries(
    Object.entries(record(raw.purposes)).map(([purpose, input]) => {
      if (!Object.hasOwn(purposeNames, purpose) && purpose !== 'embedding') throw Error('未知模型用途')
      const value = record(input),
        parse = purpose === 'embedding' ? embeddingParameters : purposeParameterJson
      if (!Array.isArray(value.ignored) || value.ignored.some((v) => typeof v !== 'string'))
        throw Error('无效参数策略结果')
      return [
        purpose,
        {
          defaults: parse(value.defaults),
          effective: parse(value.effective),
          overrides: parse(value.overrides),
          constraints: record(value.constraints),
          ignored: value.ignored,
        },
      ]
    })
  )
}
export function parameterDifference(input: Record<string, unknown>, defaults: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaults[key]))
  )
}
