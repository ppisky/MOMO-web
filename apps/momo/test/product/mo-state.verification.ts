import assert from 'node:assert/strict';
import { list, record } from '../../src/product/contracts/core';
import { newPolicy } from '../../src/product/contracts/assets';
import { managedDdm, stateConstraints, stateManagement } from '../../src/product/contracts/mo-state';
import type { CoreClient } from '../../src/product/lib/server/core.server';

export async function verifyMoState({ client, space, other, roleId, conversationId, get, post, call, upstream }: {
  client: CoreClient; space: string; other: string; roleId: string; conversationId: string;
  get: (kind: string, space: string) => Promise<unknown>;
  post: (input: unknown) => Promise<Response>;
  call: (path: string, input: unknown) => Promise<Response>;
  upstream: { body: Record<string, unknown> }[];
}) {
  const checked = async (response: Response) => { assert.equal(response.status, 200, await response.clone().text()); return response.json(); };
  const beforeCalls = upstream.length;
  const beforeHistory = await client.messages(conversationId);
  const before = await get('state-management', space);
  assert.deepEqual(await get('state-management', space), before);
  assert.equal(upstream.length, beforeCalls, 'management query must not call models');
  assert.deepEqual(await client.messages(conversationId), beforeHistory);
  assert.deepEqual(stateManagement(await get('state-management', other), other).operations, []);
  assert.equal((await post({ command: 'state-ddm-reset', spaceId: other, id: roleId })).status, 404);
  const policy = { ...newPolicy(space), revision: 1, owner_character_id: roleId };
  await checked(await call('assets', { spaceId: space, expected_revision: null, policy,
    content: { kind: 'memory', body: '管理验证：港口遇险，角色受伤，伙伴守护。', metadata: {
      id: 'state-management-memory', type: 'event', status: 'active', importance: 0.9, weight: 0.9,
      decay_at: 0, touch_at: 0, archived_at: null, relations: {}, tags: ['wounded', 'trust', 'danger'], aliases: ['管理验证'],
      injection_scope: 'character', injection_conversation_id: null, injection_character_id: roleId,
    } } }));
  const identities = list(await get('identities', space), record);
  const identity = identities.find((item) => item.conversation_id === conversationId)!;
  await checked(await call('assets', { spaceId: space, expected_revision: null,
    policy: { ...policy, fact_kind: 'rule', continuity_ids: [identity.continuity_id] },
    content: { kind: 'semantic_graph', node: { id: 'state-management-node', graph_id: 'default', type: 'rule', importance: 0.9,
      mode: 'canon', status: 'active', zone: 'auto', anchors: ['管理验证'], condition: '港口遇险', trigger: '受伤', constraint: 'injury',
      consequence: '保护受伤角色', source_character_ids: [], inject_character_ids: [roleId], edges: [] } } }));
  const configure = async (mode: string) => {
    const runtime = record(await get('runtime', space));
    await checked(await post({ command: 'runtime-save', spaceId: space, revision: runtime.revision,
      patch: { mo_state: { profile: 'closed_autonomous', injection_mode: mode, ddm: { enabled: true } } } }));
  };
  const generate = async () => {
    const requestId = crypto.randomUUID();
    const response = await call('chat', { spaceId: space, conversationId, requestId, input: '管理验证，港口遇险，受伤 injury，伙伴守护 trust。', stream: false });
    assert.equal(response.status, 200, await response.clone().text());
    const output = await response.text(); assert.ok(output.includes('response.completed'), output);
    const result = stateManagement(await get('state-management', space), space);
    const operation = result.operations.find((item) => item.response?.request_id === requestId);
    assert.ok(operation, 'completed operation must link its actual response');
    assert.equal(operation.phase, 'completed');
    assert.equal(operation.response?.conversation_id, conversationId);
    assert.ok(operation.snapshot?.records?.some((item) => item.id === `${space}/dmw/state-management-memory`), JSON.stringify(operation.snapshot));
    assert.ok(operation.snapshot.records?.some((item) => item.id === `${space}/nsg/state-management-node`));
    assert.ok(stateConstraints(operation.snapshot.state_context).some((section) => section.lines.length > 0));
    return operation;
  };
  await configure('shadow');
  const shadow = await generate();
  assert.equal(shadow.response?.injection_status, 'shadow');
  assert.equal(shadow.response.state_section, null);
  await configure('active');
  const active = await generate();
  assert.equal(active.response?.injection_status, 'active');
  assert.ok(active.response.state_section?.injected_tokens);
  const cached = managedDdm(await get(`state-ddm&id=${roleId}`, space), roleId);
  assert.ok(cached?.dispositions.length);
  const role = (await client.characters()).find((item) => item.id === roleId);
  const memory = await get('memory', space), graph = await get('nsg', space), report = await get('state-management', space);
  const count = upstream.length;
  await checked(await post({ command: 'state-ddm-reset', spaceId: space, id: roleId }));
  assert.equal(await get(`state-ddm&id=${roleId}`, space), null);
  assert.deepEqual((await client.characters()).find((item) => item.id === roleId), role);
  assert.deepEqual(await get('memory', space), memory); assert.deepEqual(await get('nsg', space), graph);
  assert.deepEqual(await get('state-management', space), report);
  assert.equal(upstream.length, count, 'reset removes the derived cache without generating a replacement');
  await generate();
  assert.ok(managedDdm(await get(`state-ddm&id=${roleId}`, space), roleId));
  console.log('PASS: MO State read-only scoped management, actual active/shadow injection, captured evidence, DDM reset/regeneration and preserved assets');
}
