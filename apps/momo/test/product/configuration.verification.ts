import assert from 'node:assert/strict'
import { zstdDecompressSync } from 'node:zlib'
import { record, list } from '../../src/product/contracts/core'
import { newPolicy } from '../../src/product/contracts/assets'
import type { CoreClient } from '../../src/product/lib/server/core.server'
export async function verifyConfiguration({
  get,
  post,
  call,
  client,
  space,
  other,
  roleId,
  conversationId,
  upstream,
}: {
  get: (kind: string, space: string) => Promise<unknown>
  post: (input: unknown) => Promise<Response>
  call: (path: string, input: unknown) => Promise<Response>
  client: CoreClient
  space: string
  other: string
  roleId: string
  conversationId: string
  upstream: { body: Record<string, unknown> }[]
}) {
  const checked = async (response: Response) => {
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  const full = await checked(
    await call('characters', {
      spaceId: space,
      name: 'Full card',
      persona: 'Persona config',
      version: '2.2.1',
      author_name: 'Integration author',
      author_url: 'https://example.com',
      user_markdown: 'User context marker',
      opening_markdown: 'Opening context marker',
    })
  )
  assert.equal(full.author_name, 'Integration author')
  assert.equal(full.version, '2.2.1')
  const chat = await client.createConversation(full.id)
  assert.deepEqual(
    (await client.messages(chat.id)).map((m) => m.content),
    ['Opening context marker']
  )
  assert.deepEqual(
    (await client.messages(chat.id)).map((m) => m.content),
    ['Opening context marker']
  )
  await checked(
    await post({
      spaceId: space,
      command: 'character-save',
      id: full.id,
      name: 'Full card changed',
      persona: 'Updated',
      version: '2.2.2',
      author_name: 'Author changed',
      author_url: null,
      user_markdown: 'User changed',
      opening_markdown: 'Next opening',
    })
  )
  const changed = (await client.characters()).find((r) => r.id === full.id)!
  assert.equal(changed.user_markdown, 'User changed')
  assert.equal(changed.opening_markdown, 'Next opening')
  assert.equal(changed.version, '2.2.2')
  assert.equal((await client.messages(chat.id))[0]?.content, 'Opening context marker')
  const policy = { ...newPolicy(space), revision: 1, owner_character_id: roleId }
  const memory = {
    id: 'editable-web-memory',
    type: 'event',
    status: 'active',
    importance: 0.8,
    weight: 0.9,
    decay_at: 0,
    touch_at: 0,
    archived_at: null,
    relations: {},
    tags: [],
    aliases: ['可编辑的记忆'],
    injection_scope: 'conversation',
    injection_conversation_id: conversationId,
    injection_character_id: roleId,
  }
  const create = {
    spaceId: space,
    expected_revision: null,
    content: { kind: 'memory', metadata: memory, body: 'Memory before' },
    policy,
  }
  await checked(await call('assets', create))
  const history = async (graph = false, id = memory.id) =>
    record(record(record(record(await get(`provenance&graph=${graph}`, space)).ledger).records)[id])
  let h = await history()
  const first = JSON.stringify(list(h.revisions, record)[0])
  const edit = {
    ...create,
    expected_revision: list(h.revisions, record).length,
    policy: { ...policy, revision: Number(record(h.policy).revision) + 1 },
    content: {
      kind: 'memory',
      metadata: { ...memory, injection_scope: 'character', injection_conversation_id: null },
      body: 'Memory after',
    },
  }
  await checked(await call('assets', edit))
  assert.equal((await call('assets', edit)).status, 409)
  const saved = record(await get(`memory-content&id=${memory.id}`, space))
  assert.equal(saved.body, 'Memory after')
  assert.equal(record(saved.metadata).injection_conversation_id, null)
  assert.equal(JSON.stringify(list((await history()).revisions, record)[0]), first)
  h = await history()
  const archive = {
    ...edit,
    expected_revision: list(h.revisions, record).length,
    policy: { ...policy, revision: Number(record(h.policy).revision) + 1 },
    content: {
      ...edit.content,
      metadata: { ...edit.content.metadata, status: 'archived', archived_at: Math.floor(Date.now() / 1000) },
    },
  }
  await checked(await call('assets', archive))
  assert.equal(record(await get(`memory-content&id=${memory.id}`, space)).status, 'archived')
  h = await history()
  await checked(
    await call('assets', {
      ...edit,
      expected_revision: list(h.revisions, record).length,
      policy: { ...policy, revision: Number(record(h.policy).revision) + 1 },
    })
  )
  assert.equal((await call('assets', { ...create, spaceId: other })).status, 403)
  const identities = list(await get('identities', space), record)
  const identity = identities.find((i) => i.conversation_id === conversationId)!
  assert.ok(identity)
  const graphPolicy = { ...policy, fact_kind: 'rule', continuity_ids: [identity.continuity_id] }
  const node = {
    id: 'editable-web-node',
    graph_id: 'default',
    type: 'rule',
    importance: 0.8,
    mode: 'canon',
    status: 'active',
    zone: 'auto',
    anchors: ['归航约定'],
    condition: '归航',
    trigger: '到港',
    constraint: '登记',
    consequence: '记住归航',
    source_character_ids: [],
    inject_character_ids: [roleId],
    edges: [],
  }
  await checked(
    await call('assets', {
      spaceId: space,
      expected_revision: null,
      content: { kind: 'semantic_graph', node },
      policy: graphPolicy,
    })
  )
  await checked(
    await call('assets', {
      spaceId: space,
      expected_revision: null,
      content: {
        kind: 'semantic_graph',
        node: {
          ...node,
          id: 'editable-web-node-2',
          anchors: ['港口'],
          edges: [{ category: 'structural', relation: 'contains', weight: 0.8, target: node.id }],
        },
      },
      policy: graphPolicy,
    })
  )
  const nodes = list(await get('nsg', space), record)
  assert.equal(nodes.length, 2)
  assert.equal(list(nodes.find((n) => n.id === 'editable-web-node-2')!.edges, record)[0]?.target, node.id)
  const graphHistory = await history(true, node.id)
  const graphEdit = {
    spaceId: space,
    expected_revision: list(graphHistory.revisions, record).length,
    content: { kind: 'semantic_graph', node: { ...node, status: 'archived' } },
    policy: { ...graphPolicy, revision: Number(record(graphHistory.policy).revision) + 1 },
  }
  await checked(await call('assets', graphEdit))
  assert.equal(list(await get('nsg', space), record).find((n) => n.id === node.id)?.status, 'archived')
  assert.equal((await call('assets', graphEdit)).status, 409)
  const restore = await history(true, node.id)
  await checked(
    await call('assets', {
      ...graphEdit,
      expected_revision: list(restore.revisions, record).length,
      content: { kind: 'semantic_graph', node },
      policy: { ...graphPolicy, revision: Number(record(restore.policy).revision) + 1 },
    })
  )
  let requestCount = upstream.length
  let response = await call('chat', {
    spaceId: space,
    conversationId: chat.id,
    requestId: crypto.randomUUID(),
    input: '继续开场的故事',
  })
  assert.equal(response.status, 200)
  assert.ok((await response.text()).includes('response.completed'))
  let foreground = upstream.slice(requestCount).find((r) => r.body.stream === true)
  assert.ok(foreground)
  let prompt = JSON.stringify(foreground.body.messages)
  assert.ok(prompt.includes('Opening context marker'), prompt)
  assert.ok(prompt.includes('User changed'), prompt)
  requestCount = upstream.length
  response = await call('chat', {
    spaceId: space,
    conversationId: conversationId,
    requestId: crypto.randomUUID(),
    input: 'Memory after，归航约定，到港登记',
  })
  assert.equal(response.status, 200)
  assert.ok((await response.text()).includes('response.completed'))
  foreground = upstream.slice(requestCount).find((r) => r.body.stream === true)
  assert.ok(foreground)
  const messages = list(foreground.body.messages, record).filter((m) => m.role !== 'user')
  prompt = JSON.stringify(messages)
  assert.ok(prompt.includes('Memory after'), 'configured memory must enter model context')
  assert.ok(prompt.includes('登记'), 'configured NSG must enter model context')
  const orphanConversation = await client.createConversation(roleId)
  const orphan = {
    ...create,
    content: {
      kind: 'memory',
      metadata: { ...memory, id: 'orphaned-memory', injection_conversation_id: orphanConversation.id },
      body: 'Preserved after conversation removal',
    },
  }
  await checked(await call('assets', orphan))
  await client.request(`/v1/conversations/${orphanConversation.id}?space_id=${space}`, { method: 'DELETE' })
  const orphanHistory = await history(false, 'orphaned-memory')
  await checked(
    await call('assets', {
      ...orphan,
      expected_revision: list(orphanHistory.revisions, record).length,
      policy: { ...policy, revision: Number(record(orphanHistory.policy).revision) + 1 },
      content: { ...orphan.content, body: 'Still editable without broadening scope' },
    })
  )
  const orphanSaved = record(await get('memory-content&id=orphaned-memory', space))
  assert.equal(record(orphanSaved.metadata).injection_conversation_id, orphanConversation.id)
  const state = record(await get('runtime', space))
  const config = {
    spaceId: space,
    command: 'runtime-save',
    revision: state.revision,
    patch: { mo_state: { injection_mode: 'shadow', ddm: { enabled: true }, memory_lifecycle: { auto_forget: false } } },
  }
  await checked(await post(config))
  assert.equal((await post(config)).status, 409)
  const stateAfter = record(await get('runtime', space))
  const ms = record(record(stateAfter.settings).mo_state)
  assert.equal(ms.injection_mode, 'shadow')
  assert.equal(record(ms.ddm).enabled, true)
  assert.equal(record(ms.memory_lifecycle).auto_forget, false)
  await checked(await post({ ...config, revision: stateAfter.revision, patch: { mo_state: null } }))
  assert.equal(record(record(record(await get('runtime', space)).settings).mo_state).injection_mode, 'active')
  const contract = record(await get('state-contract', space))
  const contractSave = {
    spaceId: space,
    command: 'state-contract-save',
    revision: contract.revision,
    content: String(contract.content) + '\n# integration contract\n',
  }
  await checked(await post(contractSave))
  assert.equal((await post(contractSave)).status, 409)
  const contractAfter = record(await get('state-contract', space))
  assert.equal(contractAfter.source, 'override')
  await checked(await post({ spaceId: space, command: 'state-contract-reset', revision: contractAfter.revision }))
  assert.equal(record(await get('state-contract', space)).source, 'builtin')
  assert.ok(record(await get('state-runtime', space)).memory_lifecycle)
  const plan = {
    characters: [{ space_id: space, character_ids: [full.id] }],
    conversations: [],
    memory: [space],
    semantic_graph: [],
    compatibility: 'none',
  }
  const download = await call('moc', { plan, protection: { type: 'none' } })
  assert.equal(download.status, 200, await download.clone().text())
  assert.match(download.headers.get('Content-Disposition') ?? '', /\.moc/)
  const unpacked = zstdDecompressSync(Buffer.from(await download.arrayBuffer()), { maxOutputLength: 16777216 })
  const contents = new Map<string, string>()
  for (let offset = 0; offset + 512 <= unpacked.length; ) {
    const header = unpacked.subarray(offset, offset + 512)
    const name = header.subarray(0, 100).toString().split('\0')[0]!
    if (!name) break
    const length = parseInt(header.subarray(124, 136).toString().replace(/\0/g, '').trim() || '0', 8)
    contents.set(name, unpacked.subarray(offset + 512, offset + 512 + length).toString())
    offset += 512 + Math.ceil(length / 512) * 512
  }
  const manifest = contents.get('manifest.toml')!
  assert.ok(manifest)
  assert.ok(manifest.includes(space))
  assert.ok(!manifest.includes(other))
  assert.ok(!manifest.includes('semantic_graph'))
  assert.ok(!manifest.includes('conversations'))
  const exported = [...contents.values()].join('\n')
  assert.ok(exported.includes(full.id))
  assert.ok(exported.includes('Memory after'))
  assert.ok(!exported.includes('fixture-private-key'))
  assert.ok(!exported.includes('Next opening') || exported.includes('Author changed'))
  // Only one role was selected; additional roles must not be exported in character payloads.
  const cardPayloads = [...contents.entries()]
    .filter(([name]) => name.startsWith('characters/'))
    .map(([, body]) => body)
    .join('\n')
  assert.ok(cardPayloads.includes(full.id))
  assert.ok(!cardPayloads.includes(roleId))
  const encrypted = await call('moc', {
    plan: { ...plan, memory: [] },
    protection: { type: 'passphrase', value: 'integration-only-passphrase' },
  })
  assert.equal(encrypted.status, 200, await encrypted.clone().text())
  const encryptedTar = zstdDecompressSync(Buffer.from(await encrypted.arrayBuffer()))
  assert.ok(!encryptedTar.toString().includes('Author changed'))
  assert.ok(!encryptedTar.toString().includes('integration-only-passphrase'))
  assert.equal(
    (
      await call('moc', {
        plan: { ...plan, memory: [other], characters: [{ space_id: other, character_ids: [full.id] }] },
        protection: { type: 'none' },
      })
    ).status,
    400
  )
  console.log(
    'PASS: full role/opening; atomic memory and NSG editing/archive/CAS; MO State settings/contract; scoped and encrypted MOC downloads'
  )
}
