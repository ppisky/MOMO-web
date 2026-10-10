import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embeddingFromJson, embeddingParameterJson, embeddingParameters, parameters, purposeParameterJson, resolvedParameters } from '../../src/product/contracts/parameters'
import { parameterDifference, purposeConfigurations } from '../../src/product/contracts/purpose-parameters'
import { resolveParameters } from '../../src/product/lib/server/resolve-parameters.server'

test('background deltas stay independent, reset by omission and survive frozen replay', () => {
  const providerId = crypto.randomUUID(), id = crypto.randomUUID()
  const catalog = { revision: 0, providers: [{ id: providerId, name: 'Fixture', protocol: 'openai' as const, base_url: 'http://127.0.0.1:9/v1', api_path: '', has_api_key: false }],
    models: (['chat', 'vision', 'embedding'] as const).map((kind, index) => ({ id: crypto.randomUUID(), provider_id: providerId, name: kind, model_id: kind, kind, context_window: null, max_output_tokens: null, reference: `configured_${String(index).repeat(64)}` })) }
  const [chat, vision, embedding] = catalog.models
  const config = parameters({ revision: 0, selectedId: id, groups: [{ id, name: 'Fixture', modelId: chat!.id, temperature: 0.9, topP: 0.8, maxOutput: 200, parameters: { frequency_penalty: 0.4 } }],
    purposes: { vision: vision!.id }, purposeParameters: { vision: { temperature: 0.25, max_output_tokens: 512 }, memory_distillation: { top_p: 0.5 } }, embedding: { modelId: embedding!.id, dimension: 3, parameters: { dimensions: 3 } } })
  const frozen = resolvedParameters(resolveParameters(config, catalog))
  assert.deepEqual(frozen.modelRoutes?.vision, { model: vision!.reference, temperature: 0.25, max_output_tokens: 512 })
  assert.deepEqual(frozen.modelRoutes?.memory_distillation, { model: chat!.reference, top_p: 0.5 })
  assert.deepEqual(frozen.modelRoutes?.semantic_graph_governance, { model: chat!.reference })
  assert.equal(frozen.embedding?.dimension, 3)
  const reset = parameters({ ...config, purposeParameters: { vision: {} }, embedding: { modelId: embedding!.id, dimension: 3 } })
  assert.equal(reset.purposeParameters, undefined)
  assert.equal(reset.groups[0]?.temperature, 0.9)
  assert.deepEqual(resolveParameters(reset, catalog).modelRoutes?.vision, { model: vision!.reference })
  assert.equal(frozen.modelRoutes?.vision.temperature, 0.25)
})

test('Core defaults are removed from portable deltas; generation and embeddings reject cross-purpose control', () => {
  const defaults = { temperature: 0, max_output_tokens: 1024 }
  assert.deepEqual(parameterDifference(purposeParameterJson({ ...defaults, top_p: 0.5 }), defaults), { top_p: 0.5 })
  for (const invalid of [{ stream: true }, { model: 'other' }, { max_output_tokens: 0 }, { temperature: 5 }]) assert.throws(() => purposeParameterJson(invalid))
  assert.throws(() => embeddingParameters({ temperature: 0.2 }))
  assert.throws(() => embeddingParameters({ send_dimensions: 1 }))
  assert.throws(() => embeddingParameters({ query_prefix: '长'.repeat(1400) }))
  assert.deepEqual(embeddingParameters({ encoding_format: 'float', dimensions: null }), { encoding_format: 'float' })
  const input = { version: 1, purposes: { vision: { defaults, effective: defaults, overrides: {}, constraints: {}, ignored: [] } } }
  assert.deepEqual(purposeConfigurations(input).vision?.defaults, defaults)
  assert.throws(() => purposeConfigurations({ ...input, version: 2 }))
})

test('embedding dimension follows the model by omission and shares form, JSON and saved state', () => {
  const selection = { modelId: crypto.randomUUID(), dimension: null }
  assert.deepEqual(embeddingParameterJson(selection), {})
  const custom = embeddingFromJson(selection, { encoding_format: 'float', dimensions: 1024 })
  assert.equal(custom.dimension, 1024)
  assert.deepEqual(embeddingParameterJson(custom), { dimensions: 1024 })
  assert.deepEqual(embeddingFromJson(custom, { encoding_format: 'float' }), selection)
  const id = crypto.randomUUID(), group = { id, name: 'Fixture', temperature: null, topP: null, maxOutput: null }
  assert.equal(parameters({ revision: 0, selectedId: id, groups: [group], embedding: selection }).embedding?.dimension, null)
  assert.deepEqual(resolvedParameters({ ...group, embedding: { model: 'configured_fixture', dimension: null } }).embedding, { model: 'configured_fixture', dimension: null })
  for (const dimensions of [0, -1, 1.5, '1536', 8193]) assert.throws(() => embeddingFromJson(selection, { dimensions }))
  assert.throws(() => embeddingFromJson(selection, { encoding_format: 'base64' }))
  assert.throws(() => parameters({ revision: 0, selectedId: id, groups: [group], embedding: { ...custom, parameters: { dimensions: 512 } } }))
})
