import { record, text, uuid, list } from './core'
export type Policy = {
  revision: number
  local_space_id: string
  personal_space_id: string
  owner_character_id: string | null
  readers: string[]
  continuity_ids: string[]
  function_ids: string[]
  fact_kind: string
  subjects: string[]
  participants: string[]
  responsible_characters: string[]
  valid_from: number | null
  valid_until: number | null
}
export type MemoryMetadata = {
  id: string
  type: string
  importance: number | null
  weight: number | null
  touch_at: number
  decay_at: number | null
  archived_at: number | null
  relations: Record<string, string[]>
  tags: string[]
  aliases: string[]
  injection_scope: string | null
  injection_conversation_id: string | null
  injection_character_id: string | null
  status: string
}
export type Edge = { category: string; relation: string; weight: number; target: string }
export type Node = {
  id: string
  graph_id: string
  type: string
  importance: number
  mode: string
  status: string
  zone: string
  anchors: string[]
  condition: string
  trigger: string
  consequence: string
  constraint: string
  source_character_ids: string[]
  inject_character_ids: string[]
  edges: Edge[]
}
export const edgeTypes: Record<string, { label: string; relations: Record<string, string> }> = {
  structural: { label: '结构', relations: { located_in: '位于', part_of: '属于', owned_by: '归属', contains: '包含' } },
  causal: { label: '因果', relations: { causes: '导致', leads_to: '引向', trigger: '触发', prevents: '阻止' } },
  constraint: {
    label: '约束',
    relations: { forbidden_by: '被禁止', limited_by: '被限制', requires: '需要', weak_against: '弱于' },
  },
  narrative: {
    label: '叙事',
    relations: { betrayed_by: '被背叛', remembered_with: '共同记忆', changed_after: '在其后改变', allied_with: '结盟' },
  },
}
export function strings(value: unknown) {
  return list(value, (v) => text(v, 'item'))
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('数值无效')
  return value
}
function nullable<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value == null ? null : parse(value)
}
export function policy(value: unknown): Policy {
  const p = record(value)
  return {
    revision: number(p.revision),
    local_space_id: uuid(p.local_space_id),
    personal_space_id: uuid(p.personal_space_id),
    owner_character_id: nullable(p.owner_character_id, uuid),
    readers: list(p.readers, uuid),
    continuity_ids: list(p.continuity_ids, uuid),
    function_ids: strings(p.function_ids),
    fact_kind: text(p.fact_kind, 'fact_kind'),
    subjects: strings(p.subjects),
    participants: list(p.participants, uuid),
    responsible_characters: list(p.responsible_characters, uuid),
    valid_from: nullable(p.valid_from, number),
    valid_until: nullable(p.valid_until, number),
  }
}
export function metadata(value: unknown): MemoryMetadata {
  const m = record(value)
  const stringOrNull = (v: unknown) => nullable(v, (v) => text(v, 'scope'))
  return {
    id: text(m.id, 'id'),
    type: text(m.type, 'type'),
    importance: nullable(m.importance, number),
    weight: nullable(m.weight, number),
    touch_at: number(m.touch_at),
    decay_at: nullable(m.decay_at, number),
    archived_at: nullable(m.archived_at, number),
    status: text(m.status, 'status'),
    aliases: strings(m.aliases),
    tags: strings(m.tags),
    relations: Object.fromEntries(Object.entries(record(m.relations)).map(([k, v]) => [k, strings(v)])),
    injection_scope: stringOrNull(m.injection_scope),
    injection_character_id: stringOrNull(m.injection_character_id),
    injection_conversation_id: stringOrNull(m.injection_conversation_id),
  }
}
export function node(value: unknown): Node {
  const n = record(value)
  return {
    id: text(n.id, 'id'),
    graph_id: text(n.graph_id, 'graph_id'),
    type: text(n.type, 'type'),
    importance: number(n.importance),
    mode: text(n.mode, 'mode'),
    status: text(n.status, 'status'),
    zone: text(n.zone, 'zone'),
    anchors: strings(n.anchors),
    condition: text(n.condition, 'condition'),
    trigger: text(n.trigger, 'trigger'),
    constraint: text(n.constraint, 'constraint'),
    consequence: text(n.consequence, 'consequence'),
    source_character_ids: strings(n.source_character_ids),
    inject_character_ids: strings(n.inject_character_ids),
    edges: list(n.edges, (value) => {
      const e = record(value)
      return {
        category: text(e.category, 'category'),
        relation: text(e.relation, 'relation'),
        weight: number(e.weight),
        target: text(e.target, 'target'),
      }
    }),
  }
}
export function newPolicy(space: string): Policy {
  return {
    revision: 0,
    local_space_id: space,
    personal_space_id: space,
    owner_character_id: null,
    readers: [],
    continuity_ids: [],
    function_ids: [],
    fact_kind: 'experience',
    subjects: [],
    participants: [],
    responsible_characters: [],
    valid_from: null,
    valid_until: null,
  }
}
