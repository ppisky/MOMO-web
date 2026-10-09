import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoreClient, CoreError, hostConfig } from '../../src/product/lib/server/core.server.ts';
import { actionError, actionInput } from '../../src/product/lib/server/actions.server.ts';
import { character, conversation, message, uuid } from '../../src/product/contracts/core.ts';

const personal = '00000000-0000-4000-8000-000000000101';
const space = '00000000-0000-4000-8000-000000000102';
const conv = '00000000-0000-4000-8000-000000000103';
const char = '00000000-0000-4000-8000-000000000104';
const requestId = '00000000-0000-4000-8000-000000000105';
const config = { coreOrigin: 'http://127.0.0.1:8765', personalSpaceId: personal, conversationSpaceId: space };
const convDTO = { id: conv, space_id: space, character_id: char, title: '故事' };
const calls: { path: string; init?: RequestInit }[] = [];
const transport: typeof fetch = async (input, init) => {
  const path = String(input).replace(config.coreOrigin, ''); calls.push({ path, ...(init ? { init } : {}) });
  if (path.startsWith('/v1/conversations?')) return Response.json([convDTO]);
  if (path.startsWith('/v1/characters?')) return Response.json([{ id: char, owner_space_id: personal, name: '月', character_markdown: '安静' }]);
  if (path === '/v1/momo/responses') return new Response('data: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  if (path === '/v1/conversations') return Response.json(convDTO);
  if (path === '/health') return Response.json({ ok: true, service: 'momo-server', core_version: '1.0.0-rc.1' });
  return Response.json({ ok: true });
};

test('DTO boundaries reject arrays, arbitrary IDs, unsupported roles and malformed dates', () => {
  assert.throws(() => uuid('../../private')); assert.throws(() => character([]));
  assert.throws(() => conversation({ ...convDTO, character_id: undefined }));
  assert.throws(() => message({ id: requestId, conversation_id: conv, role: 'tool', content: 'x', created_at: '2026-10-07T00:00:00Z' }));
  assert.throws(() => message({ id: requestId, conversation_id: conv, role: 'user', content: 'x', created_at: 'yesterday' }));
});

test('Core response uses native momo wire and preserves idempotency request ID', async () => {
  calls.length = 0; const client = new CoreClient(config, transport);
  assert.equal(await client.health(), '1.0.0-rc.1');
  for (let n = 0; n < 2; n++) await client.respond(conv, '你好', requestId, new AbortController().signal);
  const sent = calls.filter(value => value.path === '/v1/momo/responses');
  assert.equal(sent.length, 2);
  for (const call of sent) {
    const body = JSON.parse(String(call.init?.body));
    assert.equal(body.momo.schema, 'momo.responses/1.0'); assert.equal(body.momo.request_id, requestId);
    assert.equal(body.momo.conversation_id, conv); assert.equal(body.momo.personal_space_id, personal);
    assert.equal(body.momo.memory_write_space_id, personal); assert.equal(body.stream, true);
    assert.equal(call.init?.redirect, 'error'); assert.deepEqual(body.momo.memory_sources.map((v: {weight: number}) => v.weight), [70, 30]);
  }
});

test('a shared personal/conversation Space is emitted once with total weight 100', async () => {
  const shared: typeof fetch = async (input, init) => String(input).includes('/v1/conversations?')
    ? Response.json([{ ...convDTO, space_id: personal }]) : transport(input, init);
  await new CoreClient({ ...config, conversationSpaceId: personal }, shared).respond(conv, 'Hi', requestId, new AbortController().signal);
  const body = JSON.parse(String(calls.at(-1)?.init?.body)); assert.equal(body.momo.memory_sources.length, 1); assert.equal(body.momo.memory_sources[0].weight, 100);
});

test('scope violations and nonexistent conversations stop before generation', async () => {
  for (const payload of [[{ ...convDTO, space_id: personal }], []]) {
    let generated = false;
    const denied: typeof fetch = async input => { if (String(input).includes('/responses')) generated = true; return Response.json(payload); };
    await assert.rejects(new CoreClient(config, denied).respond(conv, 'Hi', requestId, new AbortController().signal));
    assert.equal(generated, false);
  }
  await assert.rejects(new CoreClient(config, async () => Response.json([{ id: char, owner_space_id: space, name: 'x', character_markdown: '' }])).characters());
});

test('cancel includes personal Space and never treats transport abort as server cancellation', async () => {
  const client = new CoreClient(config, transport); await client.cancel(requestId);
  assert.equal(calls.at(-1)?.path, `/v1/momo/responses/${requestId}/cancel`);
  assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { personal_space_id: personal });
});

test('Core private error fields are excluded from the browser response', async () => {
  const client = new CoreClient(config, async () => Response.json({ error: { code: 'model_unavailable', message: 'secret path D:/private/key' } }, { status: 503 }));
  let error: unknown; try { await client.health(); } catch (value) { error = value; }
  const response = actionError(error); assert.equal(response.status, 503);
  const body = await response.text(); assert.ok(body.includes('model_unavailable')); assert.ok(!body.includes('private'));
  assert.ok(!(await actionError(new Error('secret')).text()).includes('secret'));
});

test('action permits bounded same-origin loopback JSON and rejects cross-origin/method/type', async () => {
  const make = (headers: Record<string, string> = {}, body = '{"input":"你好"}') => new Request('http://127.0.0.1:5173/api/chat', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', ...headers }, body });
  assert.deepEqual(await actionInput(make()), { input: '你好' });
  for (const [request, status] of [[make({ Origin: 'https://remote.example' }), 403], [make({ 'Content-Type': 'application/json-fake' }), 415], [make({}, 'x'.repeat(65537)), 413], [new Request('http://127.0.0.1:5173/api/chat'), 405]] as const) {
    await assert.rejects(actionInput(request), (error: unknown) => error instanceof CoreError && error.status === status);
  }
});

test('host configuration requires loopback origin and explicit valid Space IDs', () => {
  const host = globalThis as typeof globalThis & { __MOMO_HOST_CONFIG?: typeof config };
  try {
    host.__MOMO_HOST_CONFIG = config; assert.deepEqual(hostConfig(), config);
    for (const origin of ['https://127.0.0.1:8765', 'http://remote.example', 'http://user:pass@127.0.0.1', 'http://127.0.0.1/private']) {
      host.__MOMO_HOST_CONFIG = { ...config, coreOrigin: origin }; assert.throws(hostConfig);
    }
  } finally { delete host.__MOMO_HOST_CONFIG; }
});
