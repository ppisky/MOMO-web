import assert from 'node:assert/strict'
import { zstdDecompressSync } from 'node:zlib'
import { record } from '../../src/product/contracts/core'
import { models } from '../../src/product/contracts/models'
import { purposeConfigurations } from '../../src/product/contracts/purpose-parameters'
import { emptyExportSelection } from '../../src/product/features/moc/selection'
import type { CoreClient } from '../../src/product/lib/server/core.server'
import { readParameters } from '../../src/product/lib/server/parameters.server'
import { resolveParameters } from '../../src/product/lib/server/resolve-parameters.server'

export async function verifyPurposeParameters({ call, client, space, conversation, requests }: {
  call: (path: string, input: unknown) => Promise<Response>; client: CoreClient; space: string; conversation: string
  requests: { path: string; body: Record<string, unknown> }[]
}) {
  const catalog = models(await (await client.request('/v1/model-configuration')).json())
  const vision = catalog.models.find((m) => m.kind === 'vision')!, embedding = catalog.models.find((m) => m.kind === 'embedding')!
  const checked = async (response: Response) => { assert.equal(response.status, 200, await response.clone().text()); return response.json() }
  const configure = (purpose: string, modelId: string, parameters: unknown = {}) => call('purpose-parameters', { spaceId: space, purpose, modelId, dimension: 3, parameters })
  const beforeCalls = requests.length, policyBefore = await (await client.request(`/v1/runtime-settings/metadata?space_id=${space}`)).json()
  const defaults = purposeConfigurations(await checked(await configure('vision', vision.id))).vision!
  assert.deepEqual(defaults.defaults, { temperature: 0, max_output_tokens: 1024 })
  assert.deepEqual(defaults.overrides, {})
  assert.equal(requests.length, beforeCalls, 'configuration resolution must not call a model')
  assert.deepEqual(await (await client.request(`/v1/runtime-settings/metadata?space_id=${space}`)).json(), policyBefore)
  assert.equal((await configure('vision', embedding.id)).status, 400)
  assert.equal((await configure('vision', vision.id, { stream: true })).status, 400)
  assert.equal((await configure('embedding', embedding.id, { temperature: 0.2 })).status, 400)
  assert.equal((await configure('vision', vision.id, { max_output_tokens: 100000 })).status, 400)
  const initial = readParameters()
  const custom = await checked(await call('parameters', { ...initial, spaceId: space,
    purposeParameters: { vision: { temperature: 0.25, max_output_tokens: 128 }, memory_distillation: { temperature: 0.5, max_output_tokens: 400 }, semantic_graph_governance: { temperature: 0.75, max_output_tokens: 500 } },
    embedding: { modelId: embedding.id, dimension: 3, parameters: { encoding_format: 'float', dimensions: 3 } } }))
  assert.equal(custom.embedding.dimension, 3)
  assert.equal(custom.embedding.parameters, undefined)
  assert.deepEqual(custom.groups, initial.groups)
  const native = async (image = false, maintain = false) => {
    const resolved = resolveParameters(readParameters(), catalog)
    return checked(await client.request('/v1/momo/responses', { method: 'POST', body: JSON.stringify({ model: resolved.modelReference, input: image ? [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'purpose image fixture' }, { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }] }] : 'purpose-maintenance-marker',
      stream: false, temperature: initial.groups[0]?.temperature, parameters: { frequency_penalty: 0.2 },
      momo: { schema: 'momo.responses/1.0', request_id: crypto.randomUUID(), personal_space_id: space, conversation_space_id: space, conversation_id: conversation,
        mo_state: false, memory_sources: maintain ? [{ space_id: space, label: 'fixture', weight: 100, memory: true, semantic_graph: true }] : [],
        ...(maintain ? { memory_write_space_id: space } : {}), model_routes: resolved.modelRoutes, embedding: { model: null, dimension: null } } }) }))
  }
  await checked(await client.request(`/v1/runtime-settings/${space}`, { method: 'PATCH', headers: { 'If-Match': String(record(policyBefore).revision) },
    body: JSON.stringify({ vision: { enabled: true }, runtime: { memory_distillation_enabled: true, semantic_graph_enabled: true, memory_distill_every_turns: 1, nsg_govern_every_turns: 1 } }) }))
  // Drain earlier fixture turns under their captured configurations before testing a new batch.
  const drain = () => client.request('/v1/momo/maintenance/drain', { method: 'POST', body: JSON.stringify({ space_id: space }) }).then(checked)
  await drain()
  const imageStart = requests.length
  await native(true)
  const imageCalls = requests.slice(imageStart).filter((r) => r.path !== '/v1/embeddings')
  assert.equal(imageCalls[0]?.body.model, vision.model_id)
  assert.equal(imageCalls[0]?.body.temperature, 0.25)
  assert.equal(imageCalls[0]?.body.max_tokens, 128)
  assert.equal(imageCalls[0]?.body.frequency_penalty, undefined)
  assert.ok(Math.abs(Number(imageCalls.at(-1)?.body.temperature) - Number(initial.groups[0]?.temperature)) < 0.000001)
  await native(false, true)
  await drain()
  const maintenance = () => requests.filter((r) => JSON.stringify(r.body.messages ?? []).includes('purpose-maintenance-marker') && [400, 500].includes(Number(r.body.max_tokens)))
  assert.ok(maintenance().some((r) => r.body.max_tokens === 400 && r.body.temperature === 0.5), 'memory extraction must use its captured overrides')
  assert.ok(maintenance().some((r) => r.body.max_tokens === 500 && r.body.temperature === 0.75), 'NSG governance must use its independent overrides')
  for (const request of maintenance()) assert.equal(request.body.frequency_penalty, undefined)
  const chatId = crypto.randomUUID(), embedStart = requests.length
  const chat = await call('chat', { spaceId: space, conversationId: conversation, requestId: chatId, input: 'purpose embedding fixture', stream: true })
  assert.ok((await chat.text()).includes('response.completed'))
  const embeds = requests.slice(embedStart).filter((r) => r.path === '/v1/embeddings')
  assert.ok(embeds.length > 0)
  for (const request of embeds) {
    assert.equal(request.body.encoding_format, 'float')
    for (const key of ['normalization', 'send_dimensions', 'query_prefix', 'document_prefix']) assert.equal(key in request.body, false)
  }
  for (const request of embeds) assert.equal(request.body.dimensions, 3)
  await drain()
  const empty = emptyExportSelection()
  const downloaded = await call('moc', { plan: { characters: [], ...empty.scopes, compatibility: 'none' }, configuration: { ...empty.configuration, global: ['parameters'] }, protection: { type: 'none' } })
  assert.equal(downloaded.status, 200, await downloaded.clone().text())
  const tar = zstdDecompressSync(Buffer.from(await downloaded.arrayBuffer()))
  let snapshot: Record<string, unknown> | undefined
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512), name = header.subarray(0, 100).toString().split('\0')[0]!
    if (!name) break
    const length = parseInt(header.subarray(124, 136).toString().replace(/\0/g, '').trim() || '0', 8)
    if (name.includes('momo-web-parameters') && name.endsWith('snapshot.json')) snapshot = JSON.parse(tar.subarray(offset + 512, offset + 512 + length).toString()).value
    offset += 512 + Math.ceil(length / 512) * 512
  }
  assert.ok(snapshot)
  assert.deepEqual(snapshot.purposeParameters, readParameters().purposeParameters)
  assert.equal(JSON.stringify(snapshot).includes('"defaults"'), false)
  await checked(await call('parameters', { ...readParameters(), spaceId: space, purposeParameters: {}, embedding: { modelId: embedding.id, dimension: 3 } }))
  const count = requests.length
  const replay = await call('chat', { spaceId: space, conversationId: conversation, requestId: chatId, input: 'purpose embedding fixture', stream: false })
  assert.ok((await replay.text()).includes('response.completed'))
  assert.equal(requests.length, count, 'reset must not change a completed request replay')
  const reset = readParameters()
  assert.equal(reset.purposeParameters, undefined)
  assert.equal(reset.embedding?.parameters, undefined)
  assert.deepEqual(reset.groups, initial.groups)
  const resetStart = requests.length
  await native(true)
  assert.equal(requests[resetStart]?.body.temperature, 0)
  assert.equal(requests[resetStart]?.body.max_tokens, 1024)
  const latestPolicy = record(await (await client.request(`/v1/runtime-settings/metadata?space_id=${space}`)).json())
  await checked(await client.request(`/v1/runtime-settings/${space}`, { method: 'PATCH', headers: { 'If-Match': String(latestPolicy.revision) }, body: JSON.stringify({ vision: record(record(policyBefore).settings).vision, runtime: record(record(policyBefore).settings).runtime }) }))
  console.log('PASS: Core recommended purpose requests, independent real vision/memory/NSG calls, embedding profile overrides, MOC deltas and reset/replay')
}
