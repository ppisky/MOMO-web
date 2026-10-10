import { list, record, text, uuid } from './core'

const number = (v: unknown): number => {
  if (!Number.isSafeInteger(v) || Number(v) < 0) throw Error('无效状态计数')
  return Number(v)
}
const flag = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw Error('无效状态标记')
  return v
}
const strings = (v: unknown) => list(v, (item) => text(item, '状态文本'))
const optionalStrings = (v: unknown) => (v === undefined ? [] : strings(v))
const nullableText = (v: unknown) => (v === null || v === undefined ? null : text(v, '状态文本'))
const date = (v: unknown) => {
  const value = text(v, '状态时间')
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('无效状态时间')
  return value
}

export const stateDimensions: Record<string, string> = {
  scene_constraint: '场景约束',
  physiological_state: '生理状态',
  epistemic_state: '认知边界',
  relational_stance: '关系姿态',
  emotional_tone: '情绪基调',
  ddm_constraints: '角色侧写约束',
  effective_dispositions: '本轮表达倾向',
}

// Parse Core's presentation format only; the browser never evaluates state rules.
export function stateConstraints(context: string): { key: string; label: string; lines: string[] }[] {
  const sections: { key: string; label: string; lines: string[] }[] = []
  let current: (typeof sections)[number] | undefined
  for (const line of context.split('\n')) {
    const heading = /^\[([a-z_]+)\]$/.exec(line.trim())
    if (heading) {
      current = { key: heading[1]!, label: stateDimensions[heading[1]!] ?? heading[1]!, lines: [] }
      sections.push(current)
    } else if (line.startsWith('- ') && current) current.lines.push(line.slice(2))
  }
  return sections
}

function snapshot(value: unknown, space: string) {
  const v = record(value)
  if (uuid(v.space_id) !== space) throw Error('状态快照超出当前个人空间')
  const audit = record(v.state_audit)
  const input = audit.input === undefined ? null : record(audit.input)
  const scene = record(v.scene)
  const identity = audit.memory_identity === undefined ? null : record(audit.memory_identity)
  return {
    snapshot_id: text(v.snapshot_id, 'snapshot_id'),
    space_id: space,
    profile: text(v.profile, 'profile'),
    created_at: date(v.created_at),
    snapshot_revision: number(v.snapshot_revision),
    degraded: flag(v.degraded),
    state_context: text(v.state_context, 'state_context'),
    character_id: identity?.character_id ? uuid(identity.character_id) : null,
    conversation_id: identity?.conversation_id ? uuid(identity.conversation_id) : null,
    scene: {
      id: nullableText(scene.scene_id),
      status: nullableText(scene.status),
      location: nullableText(scene.location),
      timeframe: nullableText(scene.timeframe),
      focus: nullableText(scene.focus),
      participants: optionalStrings(scene.participants),
      open_threads: optionalStrings(scene.open_threads),
      constraints: optionalStrings(scene.constraints),
      source_refs: optionalStrings(scene.source_refs),
    },
    rules: optionalStrings(audit.matched_rules),
    warnings: optionalStrings(audit.warnings),
    excluded: optionalStrings(audit.prompt_excluded_memory_ids),
    contract_source: nullableText(audit.contract_source),
    retrieval_status: nullableText(input?.retrieval_status),
    records:
      input?.records === undefined
        ? null
        : list(input.records, (item) => {
            const r = record(item)
            if (r.kind !== 'memory' && r.kind !== 'nsg') throw Error('无效状态证据类型')
            return {
              id: text(r.id, '证据 ID'),
              kind: r.kind,
              space_id: uuid(r.space_id),
              state_eligible: flag(r.state_eligible),
            }
          }),
    sources: list(v.source_versions ?? [], (item) => {
      const s = record(item)
      return {
        space_id: uuid(s.space_id),
        dmw_revision: number(s.dmw_revision),
        nsg_revision: number(s.nsg_revision),
        scene_revision: number(s.scene_revision),
      }
    }),
  }
}
export type StateSnapshot = ReturnType<typeof snapshot>

export function stateManagement(value: unknown, expectedSpace: string) {
  const v = record(value)
  const space = uuid(v.space_id)
  if (v.version !== 1 || space !== uuid(expectedSpace)) throw Error('MO State 管理接口版本或个人空间不匹配')
  const runtime = record(v.runtime)
  if (uuid(runtime.space_id) !== space) throw Error('MO State 运行状态超出当前个人空间')
  const operations = list(v.operations, (item) => {
    const o = record(item)
    const phase = text(o.phase, 'phase')
    if (!['staged', 'applying', 'projected', 'completed', 'failed'].includes(phase)) throw Error('无效状态处理阶段')
    const response = o.response === null ? null : record(o.response)
    const section = response?.state_section == null ? null : record(response.state_section)
    const injection = response ? text(response.injection_status, 'injection_status') : null
    if (
      injection !== null &&
      !['active', 'shadow', 'disabled', 'suppressed_degraded', 'suppressed_degraded_input'].includes(injection)
    )
      throw Error('无效状态注入状态')
    return {
      operation_id: text(o.operation_id, 'operation_id'),
      phase,
      event_type: text(o.event_type, 'event_type'),
      created_at: date(o.created_at),
      updated_at: date(o.updated_at),
      error: nullableText(o.error),
      snapshot: o.snapshot === null ? null : snapshot(o.snapshot, space),
      response: response
        ? {
            request_id: text(response.request_id, 'request_id'),
            conversation_id: uuid(response.conversation_id),
            injection_status: injection!,
            warnings: strings(response.warnings),
            state_section: section
              ? {
                  original_tokens: number(section.original_tokens),
                  injected_tokens: number(section.injected_tokens),
                  truncated: flag(section.truncated),
                  omitted: flag(section.omitted),
                }
              : null,
          }
        : null,
    }
  })
  if (operations.length > 20) throw Error('MO State 处理记录超出数量边界')
  return {
    space_id: space,
    operations,
    initialized: runtime.status !== 'not_initialized',
    degraded: runtime.status === 'not_initialized' ? false : flag(runtime.degraded),
    last_error: nullableText(runtime.last_error),
    current_snapshot: runtime.current_snapshot == null ? null : snapshot(runtime.current_snapshot, space),
  }
}
export type StateManagement = ReturnType<typeof stateManagement>

export function managedDdm(value: unknown, characterId: string) {
  if (value === null) return null
  const v = record(value),
    p = record(v.profile)
  if (uuid(p.character_id) !== uuid(characterId)) throw Error('角色侧写身份不匹配')
  return {
    revision: number(p.revision),
    profile: text(p.profile, '侧写算法'),
    dispositions: list(p.dispositions, (item) => {
      const d = record(item)
      if (
        typeof d.base_activation !== 'number' ||
        !Number.isFinite(d.base_activation) ||
        d.base_activation < 0 ||
        d.base_activation > 1
      )
        throw Error('无效角色倾向')
      return {
        id: text(d.id, '倾向 ID'),
        description: text(d.description, '倾向说明'),
        base: d.base_activation,
        constraints: strings(d.constraints),
      }
    }),
  }
}
export type ManagedDdm = ReturnType<typeof managedDdm>

export function injectionDescription(operation: StateManagement['operations'][number] | undefined) {
  if (!operation) return '未记录与该快照对应的实际注入审计'
  if (!operation.response)
    return operation.phase === 'completed'
      ? '旧记录未关联回复，实际注入情况未记录'
      : '本次处理未完成回复，暂无实际注入审计'
  const { injection_status: status, state_section: section } = operation.response
  if (status === 'shadow') return '仅观察，未注入对话'
  if (status === 'disabled') return '本轮未启用状态注入'
  if (status.startsWith('suppressed_')) return '状态或检索降级，本轮未注入'
  if (!section || section.omitted || section.injected_tokens === 0) return '未进入最终上下文'
  return `${section.truncated ? '裁剪后参与对话' : '已参与对话'} · ${section.injected_tokens} tokens`
}
