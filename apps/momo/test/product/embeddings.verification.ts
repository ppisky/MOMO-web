import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { record } from '../../src/product/contracts/core'
import { models } from '../../src/product/contracts/models'
import type { CoreClient } from '../../src/product/lib/server/core.server'
import { readParameters } from '../../src/product/lib/server/parameters.server'

export async function verifyEmbeddings({ call, client, space, conversation, requests }: {
  call: (path: string, input: unknown) => Promise<Response>
  client: CoreClient
  space: string
  conversation: string
  requests: { authorization: string | undefined; path: string; body: Record<string, unknown> }[]
}) {
  const catalog = models(await (await client.request('/v1/model-configuration')).json())
  const provider = catalog.providers[0]!, embeddingId = crypto.randomUUID(), visionId = crypto.randomUUID()
  const definitions = [...catalog.models, ...(['embedding', 'vision'] as const).map((kind) => ({
    id: kind === 'embedding' ? embeddingId : visionId, provider_id: provider.id, model_id: `fixture-${kind}`, name: `Fixture ${kind}`, kind, context_window: null, max_output_tokens: null,
  }))]
  const savedCatalog = await call('models', { ...catalog, models: definitions })
  assert.equal(savedCatalog.status, 200, await savedCatalog.clone().text())
  const updated = models(await savedCatalog.json())
  const current = readParameters()
  const withEmbedding = { ...current, purposes: { ...current.purposes, vision: visionId }, embedding: { modelId: embeddingId, dimension: 3 } }
  assert.equal((await call('parameters', { ...withEmbedding, purposes: { vision: current.groups[0]!.modelId } })).status, 400)
  assert.equal((await call('parameters', { ...withEmbedding, purposes: { semantic_graph_governance: embeddingId } })).status, 400)
  assert.equal((await call('parameters', { ...withEmbedding, embedding: { modelId: embeddingId, dimension: 0 } })).status, 400)
  assert.equal((await call('parameters', withEmbedding)).status, 200)
  assert.equal((await call('models', { ...updated, models: updated.models.filter((m) => m.id !== embeddingId) })).status, 400)
  const sources = async () => (await client.request('/v1/semantic-graph/nodes/list', { method: 'POST', body: JSON.stringify({ space_id: space }) })).json()
  const before = await sources()
  const embeds = () => requests.filter((r) => r.path === '/v1/embeddings')
  const chat = async () => {
    const response = await call('chat', { spaceId: space, conversationId: conversation, requestId: crypto.randomUUID(), input: '归航约定，到港登记', stream: true })
    assert.equal(response.status, 200, await response.clone().text())
    const events = await response.text()
    assert.ok(events.includes('response.completed'), events)
    return events
  }
  let events = await chat()
  assert.ok(!events.includes('embedding degraded') && !events.includes('embedding index degraded'), events)
  assert.deepEqual(embeds().map((r) => (r.body.input as unknown[]).length), [2, 1])
  for (const request of embeds()) {
    assert.equal(request.authorization, 'Bearer fixture-private-key')
    assert.equal(request.body.model, 'fixture-embedding')
    assert.equal(request.body.dimensions, 3)
    for (const key of ['temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'stream']) assert.equal(key in request.body, false)
  }
  const profile = { provider_id: provider.id, endpoint_id: provider.id, model: 'fixture-embedding', dimension: 3, normalization: 'l2', send_dimensions: true }
  const vectorId = `momo-embedding-v1:${createHash('sha256').update(JSON.stringify(profile)).digest('hex')}`
  const status = async () => (await client.request(`/v1/semantic-graph/vector-status?space_id=${space}&vector_space_id=${vectorId}`)).json()
  const indexed = record(await status())
  assert.equal(indexed.indexed_count, 2)
  assert.equal(indexed.dimension, 3)
  assert.equal(indexed.missing_count, 0)
  await chat()
  assert.deepEqual(embeds().map((r) => (r.body.input as unknown[]).length), [2, 1, 1], 'unchanged document vectors must be reused')
  assert.equal((await call('parameters', { ...readParameters(), embedding: { modelId: embeddingId, dimension: 4 } })).status, 200)
  events = await chat()
  assert.ok(events.includes('embedding index degraded') && events.includes('embedding degraded'), events)
  assert.deepEqual(await status(), indexed, 'dimension mismatch must retain the prior valid index')
  assert.deepEqual(await sources(), before, 'index updates never mutate NSG sources')
  assert.equal((await call('parameters', { ...readParameters(), embedding: { modelId: embeddingId, dimension: null } })).status, 200)
  const nativeStart = embeds().length
  events = await chat()
  assert.ok(!events.includes('embedding degraded') && !events.includes('embedding index degraded'), events)
  assert.ok(embeds().length > nativeStart)
  for (const request of embeds().slice(nativeStart)) assert.equal('dimensions' in request.body, false, 'native default must omit dimensions')
  const nativeProfile = { ...profile, send_dimensions: false }
  const nativeId = `momo-embedding-v1:${createHash('sha256').update(JSON.stringify(nativeProfile)).digest('hex')}`
  const nativeStatus = record(await (await client.request(`/v1/semantic-graph/vector-status?space_id=${space}&vector_space_id=${nativeId}`)).json())
  assert.equal(nativeStatus.dimension, 3)
  assert.equal(nativeStatus.indexed_count, 2)
  const reusedStart = embeds().length
  await chat()
  assert.deepEqual(embeds().slice(reusedStart).map((r) => (r.body.input as string[]).length), [1, 1], 'one native-dimension discovery plus one query, other documents reused')
  assert.deepEqual(await sources(), before)
  const count = embeds().length
  assert.equal((await call('parameters', { ...readParameters(), embedding: null })).status, 200)
  await chat()
  assert.equal(embeds().length, count, 'disabled configuration must not call an embedding endpoint')
  // Keep a usable configured fixture for browser acceptance.
  assert.equal((await call('parameters', { ...readParameters(), embedding: { modelId: embeddingId, dimension: 3 } })).status, 200)
  const cancelId = crypto.randomUUID()
  const pending = await call('chat', { spaceId: space, conversationId: conversation, requestId: cancelId, input: 'Cancel embedding fixture', stream: true })
  const deadline = Date.now() + 3000
  while (!embeds().some((r) => (r.body.input as string[]).some((input) => input.includes('Cancel embedding fixture'))) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(embeds().some((r) => (r.body.input as string[]).some((input) => input.includes('Cancel embedding fixture'))))
  const cancelledAt = Date.now()
  assert.equal((await call('cancel', { spaceId: space, requestId: cancelId })).status, 200)
  assert.ok((await pending.text()).includes('cancelled'))
  assert.ok(Date.now() - cancelledAt < 3000, 'cancellation must interrupt the embedding wait')
  assert.deepEqual(await status(), indexed)
  console.log('PASS: configured embeddings build/reuse real Core indexes, enter retrieval, reject wrong kinds and preserve indexes/assets on dimension mismatch')
}
