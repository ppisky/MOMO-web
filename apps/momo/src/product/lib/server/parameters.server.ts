import { resolveParameters } from './resolve-parameters.server';
// Development host configuration, separate from Core's business persistence.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parameters,
  type Parameters,
  type ResolvedParameters,
} from '../../contracts/parameters';
import type { Models } from '../../contracts/models';
import { CoreError } from './core.server';
import { createHash } from 'node:crypto';
const connections = new Map<string, DatabaseSync>();
function db() {
  const root = resolve(
    process.env.MOMO_APP_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.cwd(), 'MOMO-App'),
  );
  let database = connections.get(root);
  if (!database) {
    mkdirSync(root, { recursive: true });
    database = new DatabaseSync(join(root, 'host-config.sqlite3'));
    database.exec(
      'PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS model_parameters(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,value TEXT NOT NULL)',
    );
    const id = crypto.randomUUID();
    const initial: Parameters = {
      revision: 0,
      selectedId: id,
      groups: [{ id, name: '默认参数', temperature: null, topP: null, maxOutput: null }],
    };
    database.prepare('INSERT OR IGNORE INTO model_parameters VALUES(1,0,?)').run(JSON.stringify(initial));
    connections.set(root, database);
  }
  return database;
}
export function readParameters() {
  const row = db().prepare('SELECT value FROM model_parameters WHERE id=1').get();
  return parameters(JSON.parse(String(row?.value)));
}
export function saveParameters(input: unknown) {
  const value = parameters(input);
  const next = { ...value, revision: value.revision + 1 };
  if (
    db()
      .prepare('UPDATE model_parameters SET revision=?,value=? WHERE id=1 AND revision=?')
      .run(next.revision, JSON.stringify(next), value.revision).changes !== 1
  )
    throw new CoreError(409, 'parameter_revision_changed');
  return next;
}

// Delivery metadata only: freeze the resolved request configuration for retries,
// never store input content or a second message history here.
export function parametersForRequest(
  requestId: string,
  spaceId: string,
  conversationId: string,
  input: string,
  catalog?: Models,
) {
  const database = db();
  database.exec(
    'CREATE TABLE IF NOT EXISTS request_parameters(request_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,value TEXT NOT NULL)',
  );
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([spaceId, conversationId, input]))
    .digest('hex');
  const existing = database
    .prepare('SELECT fingerprint,value FROM request_parameters WHERE request_id=?')
    .get(requestId);
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new CoreError(409, 'request_identity_changed');
    return JSON.parse(String(existing.value)) as ResolvedParameters;
  }
  const current = readParameters();
  const group = resolveParameters(current, catalog);
  database
    .prepare('INSERT OR IGNORE INTO request_parameters VALUES(?,?,?)')
    .run(requestId, fingerprint, JSON.stringify(group));
  const row = database
    .prepare('SELECT fingerprint,value FROM request_parameters WHERE request_id=?')
    .get(requestId);
  if (row?.fingerprint !== fingerprint) throw new CoreError(409, 'request_identity_changed');
  const stored = JSON.parse(String(row.value));
  return stored as ResolvedParameters;
}
