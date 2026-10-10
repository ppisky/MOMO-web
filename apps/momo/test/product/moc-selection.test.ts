import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyExportSelection, chooseGroup, selectionState, changeQuickRange,
} from '../../src/product/features/moc/selection'
import { configurationSelection } from '../../src/product/contracts/moc'

test('quick export choices stay opt-in, share detailed wire values and isolate each group', () => {
  const initial = emptyExportSelection()
  for (const group of ['characters', 'conversations', 'assets', 'configuration'] as const)
    assert.equal(selectionState(initial, group, ['a']), 'none')
  const assets = chooseGroup(initial, 'assets', true, ['a'])
  assert.deepEqual(assets.scopes, { conversations: [], memory: ['a'], semantic_graph: ['a'] })
  assert.deepEqual(assets.characterSpaces, [])
  assert.deepEqual(assets.configuration, initial.configuration)
  const both = chooseGroup(assets, 'conversations', true, ['b'])
  const removed = chooseGroup(both, 'assets', false, ['a'])
  assert.deepEqual(removed.scopes, { conversations: ['b'], memory: [], semantic_graph: [] })
  assert.equal(selectionState(both, 'conversations', ['a']), 'partial')
})

test('detail exclusions and specific roles show partial; explicit full choice restores only its group', () => {
  let selected = chooseGroup(emptyExportSelection(), 'assets', true, ['a', 'b'])
  selected.scopes.semantic_graph = ['a']
  assert.equal(selectionState(selected, 'assets', ['a', 'b']), 'partial')
  selected = chooseGroup(selected, 'characters', true, ['a'])
  selected.allRoles = false
  selected.selectedRoles = ['role-a']
  assert.equal(selectionState(selected, 'characters', ['a']), 'partial')
  const restored = chooseGroup(selected, 'characters', true, ['a'])
  assert.equal(restored.allRoles, true)
  assert.deepEqual(restored.selectedRoles, [])
  assert.equal(selectionState(restored, 'assets', ['a', 'b']), 'partial')
})

test('range changes move selected components without adding omitted assets, global configuration or roles', () => {
  const selected = emptyExportSelection()
  selected.characterSpaces = ['a']
  selected.allRoles = false
  selected.selectedRoles = ['role-a']
  selected.scopes.memory = ['a']
  selected.configuration.global = ['models']
  selected.configuration.prompts = ['memory_distillation']
  selected.configuration.spaces = { mo_state: ['a'], memory_lifecycle: [] }
  const moved = changeQuickRange(selected, ['a'], ['b'])
  assert.deepEqual(moved.scopes, { conversations: [], memory: ['b'], semantic_graph: [] })
  assert.deepEqual(moved.configuration.spaces, { mo_state: ['b'], memory_lifecycle: [] })
  assert.deepEqual(moved.configuration.global, ['models'])
  assert.deepEqual(moved.configuration.prompts, ['memory_distillation'])
  assert.deepEqual(moved.configuration.personal_spaces, [])
  assert.deepEqual(moved.characterSpaces, ['b'])
  assert.equal(moved.allRoles, false)
  assert.deepEqual(moved.selectedRoles, [])
  assert.strictEqual(changeQuickRange(selected, ['a', 'b'], ['b', 'a']), selected)
})

test('configuration quick choice includes existing components and keeps global-only detail export valid', () => {
  const space = '11111111-1111-4111-8111-111111111111'
  const selected = chooseGroup(emptyExportSelection(), 'configuration', true, [space])
  assert.doesNotThrow(() => configurationSelection(selected.configuration))
  assert.equal(selectionState(selected, 'configuration', [space]), 'all')
  assert.equal(Object.keys(selected.configuration.spaces).length, 8)
  selected.configuration.spaces.mo_state = []
  assert.equal(selectionState(selected, 'configuration', [space]), 'partial')
  const globalOnly = changeQuickRange(selected, [space], [])
  assert.equal(globalOnly.configuration.global.length, 3)
  assert.equal(globalOnly.configuration.prompts.length, 0)
  assert.deepEqual(globalOnly.configuration.personal_spaces, [])
  assert.equal(selectionState(globalOnly, 'configuration', []), 'all')
})

test('quick configuration includes only eligible prompt overrides and detail exclusions remain partial', () => {
  const selected = chooseGroup(emptyExportSelection(), 'configuration', true, ['a'], ['assistant', 'memory_distillation'])
  assert.deepEqual(selected.configuration.prompts, ['assistant', 'memory_distillation'])
  assert.equal(selectionState(selected, 'configuration', ['a'], ['assistant', 'memory_distillation']), 'all')
  selected.configuration.prompts = ['assistant']
  assert.equal(selectionState(selected, 'configuration', ['a'], ['assistant', 'memory_distillation']), 'partial')
})
