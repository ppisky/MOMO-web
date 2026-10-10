import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embeddingParameters, parameters, purposeParameterJson, resolvedParameters } from '../../src/product/contracts/parameters'
import { parameterDifference, purposeConfigurations } from '../../src/product/contracts/purpose-parameters'
import { resolveParameters } from '../../src/product/lib/server/resolve-parameters.server'

test('background deltas stay independent, reset by omission and survive frozen replay', () => {
  const providerId = crypto.randomUUID(), id = crypto.randomUUID()
  const catalog = { revision: 0, providers: [{ id: providerId, name: 'Fixture', protocol: 'openai' as const, base_url: 'http://127.0.0.1:9/v1', api_path: '', has_api_key: false }],
    models: (['chat', 'vision', 'embedding'] as const).map((kind, index) => ({ id: crypto.randomUUID(), provider_id: providerId, name: kind, model_id: kind, kind, context_window: null, max_output_tokens: null, reference: `configured_${String(index).repeat(64)}` })) }
  const [chat, vision, embedding] = catalog.models
  const config = parameters({ revision: 0, selectedId: id, groups: [{ id, name: 'Fixture', modelId: chat!.id, temperature: 0.9, topP: 0.8, maxOutput: 200, parameters: { frequency_penalty: 0.4 } }],
    purposes: { vision: vision!.id }, purposeParameters: { vision: { temperature: 0.25, max_output_tokens: 512 }, memory_distillation: { top_p: 0.5 } }, embedding: { modelId: embedding!.id, dimension: 3, parameters: { query_prefix: 'query: ' } } })
  const frozen = resolvedParameters(resolveParameters(config, catalog))
  assert.deepEqual(frozen.modelRoutes?.vision, { model: vision!.reference, temperature: 0.25, max_output_tokens: 512 })
  assert.deepEqual(frozen.modelRoutes?.memory_distillation, { model: chat!.reference, top_p: 0.5 })
  assert.deepEqual(frozen.modelRoutes?.semantic_graph_governance, { model: chat!.reference })
  assert.equal(frozen.embedding?.parameters?.query_prefix, 'query: ')
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
  assert.deepEqual(embeddingParameters({ normalization: 'none', query_prefix: null }), { normalization: 'none' })
  const input = { version: 1, purposes: { vision: { defaults, effective: defaults, overrides: {}, constraints: {}, ignored: [] } } }
  assert.deepEqual(purposeConfigurations(input).vision?.defaults, defaults)
  assert.throws(() => purposeConfigurations({ ...input, version: 2 }))
})
