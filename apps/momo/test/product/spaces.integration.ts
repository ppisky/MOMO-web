// Explicit real-Core integration run. Only disposable test data is used; this
// does not contact a model provider or use an existing Core data directory.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { CoreClient } from '../../src/product/lib/server/core.server.ts';
import { SpaceHost } from '../../src/product/features/spaces/host.ts';
import { SqliteSpaceStorage } from '../../src/product/lib/server/spaces.server.ts';

const binary = process.env.MOMO_CORE_SERVER;
if (!binary) throw new Error('Set MOMO_CORE_SERVER to the built momo-server executable');
const root = mkdtempSync(join(tmpdir(), 'momo-real-space-'));
const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
const address = listener.address(); if (!address || typeof address === 'string') throw new Error('No loopback test port');
const port = address.port; await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(binary, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MOMO_SERVER_BIND: `127.0.0.1:${port}`, MOMO_DATA_DIR: join(root, 'core'), MOMO_MODEL_GATEWAY_ORIGIN: 'http://127.0.0.1:9/v1', MOMO_MODEL_GATEWAY_API_KEY: '' } });
let processError: Error | null = null; child.on('error', error => { processError = error; });
child.stdout.resume(); child.stderr.resume();
const storage = new SqliteSpaceStorage(join(root, 'config.sqlite3'));
const client = (id: string) => new CoreClient({ coreOrigin: origin, personalSpaceId: id, conversationSpaceId: id });
const host = new SpaceHost(storage, { inventory: id => client(id).spaceAssets(id), remove: request => client(request.source_id).removeSpace(request) }, randomUUID);
async function post(path: string, value: unknown) { const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); assert.equal(response.status, 200, await response.clone().text()); return response.json(); }

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (processError) throw processError;
    if (child.exitCode !== null) throw new Error(`Core exited: ${child.exitCode}`);
    try { const response = await fetch(origin + '/health'); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Real Core must start');
  const first = host.read().currentId; const created = host.create(0, '目标空间'); const target = created.spaces[1]!.id;
  const character = await client(first).createCharacter('测试角色', 'Only integration test data');
  const conversation = await client(first).createConversation(character.id);
  await post('/v1/messages', { space_id: first, conversation_id: conversation.id, role: 'user', content: 'test anchor' });
  await post('/v1/memory/patches/apply', { space_id: first, patch_yaml: "patches:\n  - target_file: events/test.md\n    operations:\n      - type: create\n        frontmatter:\n          id: integration_memory\n          type: event\n          importance: 0.7\n          weight: 0.9\n          decay_at: 0\n          status: active\n        content: '# integration test'\n" });
  await post('/v1/semantic-graph/patches/apply', { space_id: first, manual_authority: true, patch_yaml: "patches:\n  - target_file: lore/test.nsg\n    operations:\n      - type: create_node\n        metadata:\n          id: integration_nsg\n          type: lore\n          importance: 0.9\n          mode: draft\n          status: active\n          zone: auto\n        anchors: test\n        condition: always\n        trigger: enter\n        consequence: remember\n        constraint: none\n" });
  const inventory = await host.inventory(first);
  assert.deepEqual([inventory.characters, inventory.conversations, inventory.messages, inventory.memories, inventory.nsg_nodes], [1, 1, 1, 1, 1]);
  const moved = await host.remove(created.revision, first, inventory.revision, { kind: 'migrate', target_id: target });
  assert.equal(moved.currentId, target); assert.equal((await client(target).characters())[0]!.id, character.id);
  assert.equal((await client(target).conversations())[0]!.id, conversation.id); assert.equal((await client(target).messages(conversation.id)).length, 1);
  const targetAssets = await host.inventory(target); assert.equal(targetAssets.memories, 1); assert.equal(targetAssets.nsg_nodes, 1);
  const remaining = host.create(moved.revision, '保留空间');
  const deleted = await host.remove(remaining.revision, target, targetAssets.revision, { kind: 'delete_assets' });
  assert.equal(deleted.spaces.length, 1); assert.equal(deleted.pending, null);
  assert.deepEqual(await client(target).characters(), []); assert.deepEqual(await client(target).conversations(), []);
  await assert.rejects(client(target).spaceAssets(target));
  await assert.rejects(host.remove(deleted.revision, deleted.currentId, 'a'.repeat(64), { kind: 'delete_assets' }));
  console.log('PASS: real Core HTTP + durable App configuration: inventory, preserved IDs, memory/NSG migration, deletion, last-Space guard');
} finally {
  storage.close();
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  rmSync(root, { recursive: true });
}
