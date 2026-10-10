import assert from 'node:assert/strict';
import { conversation, list, record } from '../../src/product/contracts/core';
import type { CoreClient } from '../../src/product/lib/server/core.server';

export async function verifyConversationArchive({ client, space, other, id, get, post, webOrigin }: {
  client: CoreClient; space: string; other: string; id: string; webOrigin: string;
  get: (kind: string, space: string) => Promise<unknown>;
  post: (input: unknown) => Promise<Response>;
}) {
  const before = (await client.conversations()).find((chat) => chat.id === id)!;
  const history = await client.messages(id);
  const inventory = await client.spaceAssets(space);
  const memory = await get('memory', space), nsg = await get('nsg', space);
  const action = async (command: string, spaceId = space) => {
    const response = await post({ command, spaceId, id });
    assert.equal(response.status, spaceId === space ? 200 : 404, await response.clone().text());
    return response;
  };
  const archived = conversation(await (await action('conversation-archive')).json());
  assert.ok(archived.archived_at);
  assert.equal(archived.character_id, before.character_id);
  assert.deepEqual(conversation(await (await action('conversation-archive')).json()), archived);
  assert.ok(list(await get('archived-conversations', space), conversation).some((chat) => chat.id === id));
  assert.deepEqual(await get('archived-conversations', other), []);
  const workspace = await fetch(webOrigin + `/api/workspace?space=${space}&conversation=${id}`);
  assert.equal(workspace.status, 200, await workspace.clone().text());
  const data = record(await workspace.json());
  assert.equal(data.selected, null);
  assert.ok(!list(data.conversations, conversation).some((chat) => chat.id === id));
  await action('conversation-restore', other);
  assert.deepEqual(await client.messages(id), history);
  assert.equal((await client.conversations()).find((chat) => chat.id === id)?.archived_at, archived.archived_at);
  const renamed = await post({ command: 'conversation-rename', spaceId: space, id, title: '归档后改名' });
  assert.equal(renamed.status, 200, await renamed.clone().text());
  assert.equal(record(await renamed.json()).archived_at, archived.archived_at);
  const restored = conversation(await (await action('conversation-restore')).json());
  assert.equal(restored.id, before.id);
  assert.equal(restored.character_id, before.character_id);
  assert.equal(restored.title, '归档后改名');
  assert.equal(restored.archived_at, null);
  assert.deepEqual(conversation(await (await action('conversation-restore')).json()), restored);
  assert.deepEqual(await client.messages(id), history);
  assert.ok((await client.conversations(false)).some((chat) => chat.id === id));
  assert.ok(!list(await get('archived-conversations', space), conversation).some((chat) => chat.id === id));
  const after = await client.spaceAssets(space);
  for (const key of ['characters', 'conversations', 'messages', 'memories', 'nsg_nodes', 'deleted_items'] as const)
    assert.equal(after[key], inventory[key], `Archive must preserve ${key}`);
  assert.deepEqual(await get('memory', space), memory);
  assert.deepEqual(await get('nsg', space), nsg);
  console.log('PASS: real Core archive/restore, scoped Web lists, repeated operations, rename and preserved history/assets');
}
