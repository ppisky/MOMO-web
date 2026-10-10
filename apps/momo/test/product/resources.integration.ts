// Real Core HTTP behind the App's allowlisted resource adapter; isolated data only.
import assert from 'node:assert/strict';
import { verifyConfiguration } from './configuration.verification';
import { middleware } from '../../src/product/lib/server/http.server';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { action, loader } from '../../src/product/routes/api.resources';
import { spacesHost, coreForSpace } from '../../src/product/lib/server/spaces.server';
import { record, list } from '../../src/product/contracts/core';
import { createServer as httpServer } from 'node:http';
import { action as modelAction, loader as modelLoader } from '../../src/product/routes/api.models';
import { action as parameterAction } from '../../src/product/routes/api.parameters';
import { action as chatAction } from '../../src/product/routes/api.chat';
import { readParameters } from '../../src/product/lib/server/parameters.server';
import { models as parseModels } from '../../src/product/contracts/models';
import { parameterPolicy, enableParameterPolicy } from '../../src/product/contracts/parameter-policy';
import { verifyEmbeddings } from './embeddings.verification';
import { verifyPurposeParameters } from './purpose-parameters.verification';
import { verifyConversationArchive } from './archive.verification';
import { verifyMoState } from './mo-state.verification';

const binary = process.env.MOMO_CORE_SERVER;
if (!binary) throw Error('Set MOMO_CORE_SERVER to the pinned Core binary');
let preview: ReturnType<typeof spawn> | undefined;
const root = mkdtempSync(join(tmpdir(), 'momo-ui-resources-'));
const coreAccountSentinel = join(root, 'core', 'model-connections.json');
const hostAccountsPath = join(root, 'private-host', 'accounts.json');
mkdirSync(join(root, 'core'));
writeFileSync(coreAccountSentinel, 'not a Core resource');
const requests: { authorization: string | undefined; body: Record<string, unknown>; path: string }[] = [];
const nativeFetch = globalThis.fetch;
let wireError = '';
globalThis.fetch = async (...args) => {
  const response = await nativeFetch(...args);
  if (String(args[0]).endsWith('/v1/momo/responses') && !response.ok)
    wireError = await response.clone().text();
  return response;
};
const provider = httpServer(async (request, response) => {
  if (request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ data: [{ id: 'fixture-chat' }] }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = record(JSON.parse(Buffer.concat(chunks).toString()));
  requests.push({ authorization: request.headers.authorization, body, path: request.url ?? '' });
  if (request.url === '/v1/embeddings') {
    if ((body.input as string[]).some((input) => input.includes('Cancel embedding fixture'))) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 30000).unref();
        response.once('close', () => { clearTimeout(timer); resolve(); });
      });
      if (response.destroyed) return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ model: body.model, data: (body.input as string[]).map((_, index) => ({ index, embedding: [1, 0.5, 0.25] })) }));
    return;
  }
  if (body.stream !== true) {
    const maintenance = (body.messages as { content?: unknown }[] | undefined)?.some((m) => typeof m.content === 'string' && m.content.includes('"maintenance_kind"'));
    const definitionMessage = (body.messages as { content?: unknown }[] | undefined)?.find((m) => typeof m.content === 'string' && m.content.includes('"character_definition"'));
    const definition = definitionMessage ? record(record(JSON.parse(String(definitionMessage.content))).character_definition) : null;
    const content = definition ? JSON.stringify({ schema: 'momo.ddm/1', character_id: definition.character_id, revision: 1, profile: 'logit_additive', dispositions: [{
      id: 'gentle_voice', description: '温和表达并尊重伙伴的选择', base_activation: 0.8, constraints: ['Preserve user agency.'],
      expression: { latent: 'Keep a gentle voice.', salient: 'Speak gently.', dominant: 'Speak gently and preserve user agency.' },
    }] }) : maintenance ? 'patches: []' : '完整接入成功';
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ id: 'fixture-upstream', choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/event-stream' });
  response.end(
    `data: ${JSON.stringify({ id: 'fixture-upstream', choices: [{ delta: { content: '接入成功' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
  );
});
provider.listen(0, '127.0.0.1');
await once(provider, 'listening');
const providerAddress = provider.address();
if (!providerAddress || typeof providerAddress === 'string') throw Error('Missing provider port');
const listener = createServer();
listener.listen(0, '127.0.0.1');
await once(listener, 'listening');
const address = listener.address();
if (!address || typeof address === 'string') throw Error('Missing port');
await new Promise<void>((resolve) => listener.close(() => resolve()));
const origin = `http://127.0.0.1:${address.port}`;
process.env.MOMO_CORE_ORIGIN = origin;
process.env.MOMO_APP_DATA_DIR = join(root, 'host');
const child = spawn(binary, [], {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    MOMO_SERVER_BIND: `127.0.0.1:${address.port}`,
    MOMO_DATA_DIR: join(root, 'core'),
    MOMO_MODEL_CONNECTIONS_PATH: hostAccountsPath,
    MOMO_MODEL_GATEWAY_ORIGIN: 'http://127.0.0.1:9/v1',
    MOMO_MODEL_GATEWAY_API_KEY: '',
  },
});
child.stdout.resume();
child.stderr.resume();
const web = httpServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
web.listen(0, '127.0.0.1'); await once(web, 'listening');
const webAddress = web.address(); assert(webAddress && typeof webAddress !== 'string');
const webOrigin = 'http://127.0.0.1:' + webAddress.port;
async function get(kind: string, space: string) {
  const response = await fetch(webOrigin + '/api/resources?kind=' + kind + '&space=' + space);
  if (!response.ok && kind.startsWith('state-')) {
    const failure = await fetch(origin + '/v1/mo-state/' + kind.slice(6) + '?space_id=' + space);
    assert.equal(response.status, 200, await failure.text());
  }
  assert.equal(response.status, 200, await response.clone().text()); return response.json();
}
async function post(input: unknown) { return call(action, 'resources', input); }
async function call(_handler: typeof modelAction, path: string, input: unknown) {
  return fetch(webOrigin + '/api/' + path, { method: 'POST',
    headers: { Origin: webOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(origin + '/health')).ok;
      if (ready) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Core must start');
  const space = spacesHost().read().currentId;
  const client = coreForSpace(space);
  const role = await client.createCharacter('界面接入验证', 'Original persona');
  const edited = await post({
    spaceId: space,
    command: 'character-save',
    id: role.id,
    name: '已改名',
    persona: 'Updated persona',
  });
  assert.equal(edited.status, 200, await edited.clone().text());
  assert.equal((await client.characters())[0]?.character_markdown, 'Updated persona');
  const defaults = await Promise.all([client.createConversation(null), client.createConversation(null)]);
  assert.ok(defaults[0]!.character_id);
  assert.equal(defaults[0]!.character_id, defaults[1]!.character_id);
  const conversation = await client.createConversation(role.id);
  assert.equal(conversation.character_id, role.id);
  assert.equal(
    (await post({ spaceId: space, command: 'conversation-rename', id: conversation.id, title: '已改标题' }))
      .status,
    200,
  );
  assert.equal((await client.conversations())[0]?.title, '已改标题');
  const providerId = crypto.randomUUID(),
    modelId = crypto.randomUUID();
  const configured = await call(modelAction, 'models', {
    revision: 0,
    providers: [
      {
        id: providerId,
        name: 'Fixture',
        protocol: 'openai',
        base_url: `http://127.0.0.1:${providerAddress.port}/v1`,
        api_path: '',
        api_key: 'fixture-private-key',
      },
    ],
    models: [
      {
        id: modelId,
        provider_id: providerId,
        model_id: 'fixture-chat',
        name: 'Fixture Chat',
        kind: 'chat',
        context_window: null,
        max_output_tokens: null,
      },
    ],
  });
  assert.equal(configured.status, 200, await configured.clone().text());
  const modelConfig = parseModels(await configured.json());
  assert.equal(modelConfig.models[0]!.context_window, null);
  assert.equal((await call(modelAction, 'models', { ...modelConfig, models:modelConfig.models.map((m) => ({ ...m,context_window:0 })) })).status, 400);
  assert.equal(JSON.stringify(modelConfig).includes('fixture-private-key'), false);
  assert.equal(modelConfig.providers[0]!.has_api_key, true);
  assert.equal(record(JSON.parse(readFileSync(hostAccountsPath, 'utf8'))).current !== undefined, true);
  assert.equal(readFileSync(coreAccountSentinel, 'utf8'), 'not a Core resource');
  assert.equal((await modelLoader()).status, 200);
  const discovery = await call(modelAction, 'models', { command: 'discover', providerId });
  assert.equal(discovery.status, 200, await discovery.clone().text());
  assert.equal(record((await discovery.json()).models[0]).model_id, 'fixture-chat');
  const beforePolicy = record(await (await client.request('/v1/runtime-settings/metadata')).json());
  await client.request('/v1/runtime-settings', {
    method: 'PATCH', headers: { 'If-Match': String(beforePolicy.revision) },
    body: JSON.stringify({ request_overrides: {
      sampling: 'reject', max_output_tokens: 'reject', instructions: 'reject', allowed_parameters: ['frequency_penalty'],
    } }),
  });
  const guardedInstance = await (await client.request('/v1/runtime-settings/metadata')).json();
  const unrelatedSpace = crypto.randomUUID();
  const otherPolicy = await (await client.request(`/v1/runtime-settings/${unrelatedSpace}`)).json();
  const currentPolicy = parameterPolicy(await get('runtime', space));
  const originalParameters = readParameters();
  const savedParameters = await call(parameterAction, 'parameters', {
    ...originalParameters,
    spaceId: space,
    groups: originalParameters.groups.map((g) => ({
      ...g,
      modelId,
      temperature: 0.4,
      topP: 0.8,
      maxOutput: 256,
      parameters: { frequency_penalty: 0.2 },
    })),
  });
  assert.equal(savedParameters.status, 200, await savedParameters.clone().text());
  assert.deepEqual(await (await client.request('/v1/runtime-settings/metadata')).json(), guardedInstance);
  assert.deepEqual(parameterPolicy(await get('runtime', space)), currentPolicy);
  const staleSave = await call(parameterAction, 'parameters', originalParameters);
  assert.equal(staleSave.status, 409);
  assert.deepEqual(await (await client.request('/v1/runtime-settings/metadata')).json(), guardedInstance);
  const enable = { spaceId: space, command: 'runtime-save', revision: currentPolicy.revision, patch: enableParameterPolicy(currentPolicy) };
  assert.equal((await post(enable)).status, 200);
  assert.equal((await post(enable)).status, 409);
  const enabled = parameterPolicy(await get('runtime', space));
  assert.equal(enabled.sampling, 'allow');
  assert.deepEqual(enabled.allowedParameters.sort(), ['frequency_penalty', 'top_p']);
  assert.equal(record(record(record(await get('runtime', space)).settings).request_overrides).instructions, 'reject');
  assert.deepEqual(await (await client.request('/v1/runtime-settings')).json(), record(guardedInstance).settings);
  assert.deepEqual(await (await client.request(`/v1/runtime-settings/${unrelatedSpace}`)).json(), otherPolicy);
  const removeUsed = await call(modelAction, 'models', { ...modelConfig, models: [] });
  assert.equal(removeUsed.status, 409);
  const requestId = crypto.randomUUID();
  const generated = await call(chatAction, 'chat', {
    spaceId: space,
    conversationId: defaults[0]!.id,
    requestId,
    input: 'hello',
  });
  assert.equal(generated.status, 200, wireError || (await generated.clone().text()));
  const stream = await generated.text();
  assert.ok(stream.includes('response.completed'), stream);
  assert.ok(stream.includes('接入成功'), stream);
  const foreground = requests.find(
    (r) => r.body.stream === true && Math.abs(Number(r.body.temperature) - 0.4) < 0.00001,
  );
  assert.ok(foreground, JSON.stringify(requests.map((r) => r.body)));
  assert.equal(foreground.authorization, 'Bearer fixture-private-key');
  assert.equal(foreground.body.model, 'fixture-chat');
  assert.equal(foreground.body.top_p, 0.8);
  assert.equal(foreground.body.max_tokens, 256);
  assert.equal(foreground.body.frequency_penalty, 0.2);
  const count = requests.length;
  const replay = await call(chatAction, 'chat', {
    spaceId: space,
    conversationId: defaults[0]!.id,
    requestId,
    input: 'hello',
  });
  assert.ok((await replay.text()).includes('response.completed'));
  assert.equal(requests.length, count);
  const completeId = crypto.randomUUID();
  const historyBefore = await client.messages(defaults[0]!.id);
  const complete = await call(chatAction, 'chat', {
    spaceId: space, conversationId: defaults[0]!.id, requestId: completeId, input: 'non-stream', stream: false,
  });
  assert.equal(complete.status, 200, await complete.clone().text());
  const completeEvents = (await complete.text()).split('\n\n').filter(Boolean);
  assert.equal(completeEvents.length, 1);
  assert.ok(completeEvents[0]!.includes('response.completed'));
  assert.ok(completeEvents[0]!.includes('完整接入成功'));
  assert.ok(requests.slice(count).some((r) => r.body.stream !== true && r.body.max_tokens === 256));
  const completeCount = requests.length;
  const afterComplete = await client.messages(defaults[0]!.id);
  assert.equal(afterComplete.length, historyBefore.length + 2);
  const completeReplay = await call(chatAction, 'chat', {
    spaceId: space, conversationId: defaults[0]!.id, requestId: completeId, input: 'non-stream', stream: true,
  });
  assert.equal(completeReplay.status, 200);
  assert.equal((await completeReplay.text()).split('\n\n').filter(Boolean).length, 1);
  assert.equal(requests.length, completeCount);
  assert.deepEqual(await client.messages(defaults[0]!.id), afterComplete);
  assert.equal((await call(chatAction, 'chat', { spaceId: space, conversationId: defaults[0]!.id, requestId: crypto.randomUUID(), input: 'invalid', stream: 'true' })).status, 400);
  console.log('PASS: actual streaming and non-streaming requests, single completion and frozen-mode replay without duplicate messages');
  const prompts = list(await get('prompts', space), record);
  assert.equal(prompts.length, 6);
  assert.equal(
    (await post({ spaceId: space, command: 'prompt-save', id: 'assistant', content: 'Isolated prompt test' }))
      .status,
    200,
  );
  assert.equal(
    list(await get('prompts', space), record).find((p) => p.id === 'assistant')?.content,
    'Isolated prompt test',
  );
  assert.equal((await post({ spaceId: space, command: 'prompt-reset', id: 'assistant' })).status, 200);
  const before = record(await get('runtime', space));
  const change = {
    spaceId: space,
    command: 'runtime-save',
    revision: before.revision,
    patch: { runtime: { memory_distill_every_turns: 7 } },
  };
  assert.equal((await post(change)).status, 200);
  assert.equal((await post(change)).status, 409);
  const after = record(await get('runtime', space));
  assert.equal(record(record(after.settings).runtime).memory_distill_every_turns, 7);
  assert.equal(
    (
      await post({
        ...change,
        revision: after.revision,
        patch: { runtime: { memory_distill_every_turns: null } },
      })
    ).status,
    200,
  );
  assert.equal(
    record(record(record(await get('runtime', space)).settings).runtime).memory_distill_every_turns,
    12,
  );
  assert.deepEqual(await get('memory', space), []);
  assert.deepEqual(await get('nsg', space), []);
  assert.equal(
    (await post({ spaceId: space, command: 'prompt-save', id: '../health', content: 'x' })).status,
    400,
  );
  const second = spacesHost()
    .create(spacesHost().read().revision, 'Second')
    .spaces.find((s) => s.id !== space)!;
  assert.equal(
    (
      await post({
        spaceId: second.id,
        command: 'character-save',
        id: role.id,
        name: 'Forbidden',
        persona: 'Forbidden',
      })
    ).status,
    404,
  );
  await verifyConfiguration({
    get, post, call: (path, input) => call(action, path, input), client, space, other: second.id,
    roleId: role.id, conversationId: conversation.id, upstream: requests,
  });
  await verifyEmbeddings({ call: (path, input) => call(action, path, input), client, space, conversation: conversation.id, requests });
  await verifyPurposeParameters({ call: (path, input) => call(action, path, input), client, space, conversation: conversation.id, requests });
  await verifyConversationArchive({ client, space, other: second.id, id: conversation.id, get, post, webOrigin });
  await verifyMoState({ client, space, other: second.id, roleId: role.id, conversationId: conversation.id, get, post, call: (path, input) => call(action, path, input), upstream: requests });
  console.log(
    'PASS: Web HTTP host + real Core character editing/conversation, prompt save/reset, sparse policy/CAS, memory/NSG reads and Space isolation',
  );
  if (process.argv.includes('--browser')) {
    preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'vite.config.web.ts', '--port', '12209'], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env },
    });
    preview.stdout?.pipe(process.stdout); preview.stderr?.pipe(process.stderr);
    console.log('Isolated Core + offline model; browser verification at http://127.0.0.1:12209/ (Ctrl+C stops all fixtures).');
    await Promise.race([once(process, 'SIGINT'), once(process, 'SIGTERM'), once(preview, 'exit')]);
  }
} finally {
  preview?.kill();
  web.closeAllConnections(); web.close();
  globalThis.fetch = nativeFetch;
  provider.closeAllConnections();
  provider.close();
  child.kill();
  await once(child, 'exit').catch(() => {});
}
