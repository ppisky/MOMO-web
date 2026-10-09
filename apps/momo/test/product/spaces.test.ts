import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SpaceHost, SpaceError } from '../../src/product/features/spaces/host.ts';
import { SqliteSpaceStorage } from '../../src/product/lib/server/spaces.server.ts';
import { assetLabels, assets, directory, disposition, type Assets, type Receipt, type Removal } from '../../src/product/contracts/spaces.ts';

function inventory(id: string): Assets {
  return assets({ space_id: id, revision: 'a'.repeat(64), ...Object.fromEntries(Object.keys(assetLabels).map(key => [key, 0])), memories: 3, nsg_nodes: 2 });
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'momo-space-test-'));
  const storage = new SqliteSpaceStorage(join(root, 'config.sqlite3'));
  const requests: Removal[] = [];
  let failure: Error | null = null;
  let badReceipt = false;
  const core = { inventory: async (id: string) => inventory(id), remove: async (request: Removal): Promise<Receipt> => {
    requests.push(structuredClone(request)); if (failure) throw failure;
    return { operation_id: badReceipt ? randomUUID() : request.operation_id, source_id: request.source_id, disposition: request.disposition, assets: inventory(request.source_id) };
  } };
  const host = new SpaceHost(storage, core, randomUUID);
  return { root, storage, host, requests, core, setFailure: (value: Error | null) => { failure = value; }, corruptReceipt: () => { badReceipt = true; }, close: () => { storage.close(); rmSync(root, { recursive: true }); } };
}

test('default Space survives reopen; rename preserves identity; CAS rejects a stale second window', () => {
  const task = setup(); const other = new SqliteSpaceStorage(join(task.root, 'config.sqlite3'));
  try {
    const original = task.host.read(); assert.equal(original.spaces.length, 1);
    const created = task.host.create(original.revision, '第二个空间');
    const named = task.host.rename(created.revision, original.currentId, '私人空间');
    assert.equal(named.spaces[0]!.id, original.currentId);
    assert.equal(other.read().spaces[0]!.name, '私人空间');
    const stale = new SpaceHost(other, task.core, randomUUID);
    assert.throws(() => stale.select(original.revision, created.spaces[1]!.id), error => error instanceof SpaceError && error.code === 'space_directory_changed');
    assert.equal(task.host.select(named.revision, created.spaces[1]!.id).currentId, created.spaces[1]!.id);
  } finally { other.close(); task.close(); }
});

test('last Space cannot be deleted; unknown target and implicit deletion are rejected', async () => {
  const task = setup();
  try {
    const data = task.host.read();
    await assert.rejects(task.host.remove(data.revision, data.currentId, 'a'.repeat(64), { kind: 'delete_assets' }), error => error instanceof SpaceError && error.code === 'last_space');
    assert.equal(task.requests.length, 0);
    const created = task.host.create(data.revision, 'target');
    await assert.rejects(task.host.remove(created.revision, data.currentId, 'a'.repeat(64), { kind: 'migrate', target_id: randomUUID() }));
    assert.throws(() => disposition({})); assert.throws(() => disposition({ kind: 'delete_assets', target_id: data.currentId }));
  } finally { task.close(); }
});

test('migration preserves remaining spaces and selects destination only after the Core receipt', async () => {
  const task = setup();
  try {
    const first = task.host.read().currentId; const data = task.host.create(0, 'target'); const target = data.spaces[1]!.id;
    const result = await task.host.remove(data.revision, first, 'a'.repeat(64), { kind: 'migrate', target_id: target });
    assert.deepEqual(result.spaces, [{ id: target, name: 'target' }]); assert.equal(result.currentId, target); assert.equal(result.pending, null);
    assert.equal(task.requests[0]!.disposition.kind, 'migrate');
    assert.throws(() => task.host.requireSpace(first));
  } finally { task.close(); }
});

test('uncertain result survives reopen and retries the exact persisted operation', async () => {
  const task = setup(); let reopened: SqliteSpaceStorage | null = null;
  try {
    const first = task.host.read().currentId; const data = task.host.create(0, 'target');
    task.setFailure(new Error('connection lost after Core commit'));
    await assert.rejects(task.host.remove(data.revision, first, 'a'.repeat(64), { kind: 'delete_assets' }));
    const pending = task.host.read(); assert.equal(pending.spaces.length, 2); assert.ok(pending.pending);
    assert.throws(() => task.host.requireSpace(first), error => error instanceof SpaceError && error.code === 'space_removal_pending');
    reopened = new SqliteSpaceStorage(join(task.root, 'config.sqlite3')); const restarted = new SpaceHost(reopened, task.core, randomUUID);
    task.setFailure(null); const result = await restarted.resume();
    assert.equal(result.spaces.length, 1); assert.deepEqual(task.requests[0], task.requests[1]); assert.equal(result.pending, null);
  } finally { reopened?.close(); task.close(); }
});

test('changed asset confirmation clears only a proven rejection; malformed receipt keeps pending state', async () => {
  const task = setup();
  try {
    const data = task.host.create(0, 'target');
    task.setFailure(Object.assign(new Error('changed'), { code: 'space_assets_changed' }));
    await assert.rejects(task.host.remove(data.revision, data.currentId, 'a'.repeat(64), { kind: 'delete_assets' }));
    assert.equal(task.host.read().pending, null); assert.equal(task.host.read().spaces.length, 2);
    task.setFailure(null); task.corruptReceipt(); const fresh = task.host.read();
    await assert.rejects(task.host.remove(fresh.revision, fresh.currentId, 'a'.repeat(64), { kind: 'delete_assets' }));
    assert.ok(task.host.read().pending);
  } finally { task.close(); }
});

test('asset errors are never treated as empty; persisted configuration rejects missing or duplicate spaces', async () => {
  const task = setup();
  try {
    const hostile = new SpaceHost(task.storage, { inventory: async () => { throw new Error('Core unavailable'); }, remove: task.core.remove }, randomUUID);
    await assert.rejects(hostile.inventory(hostile.read().currentId));
    assert.throws(() => assets({ space_id: hostile.read().currentId, revision: 'a'.repeat(64) }));
    assert.throws(() => directory({ revision: 0, spaces: [], currentId: randomUUID(), pending: null }));
    const data = task.host.read(); assert.throws(() => directory({ ...data, spaces: [...data.spaces, ...data.spaces] }));
  } finally { task.close(); }
});
