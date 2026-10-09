// Web host adapter for the framework-independent SpaceStorage port.
// A future desktop host supplies its own adapter; Core owns business assets.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { directory, type SpaceDirectory } from '../../contracts/spaces';
import { SpaceHost, SpaceError, type SpaceStorage } from '../../features/spaces/host';
import { CoreClient, hostConfig } from './core.server';

export class SqliteSpaceStorage implements SpaceStorage {
  private readonly database: DatabaseSync;
  constructor(path: string, firstId: string = randomUUID()) {
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS app_spaces(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, value TEXT NOT NULL)');
    const first: SpaceDirectory = { revision: 0, spaces: [{ id: firstId, name: '默认空间' }], currentId: firstId, pending: null };
    this.database.prepare('INSERT OR IGNORE INTO app_spaces VALUES(1,0,?)').run(JSON.stringify(first));
  }
  read() {
    const row = this.database.prepare('SELECT value FROM app_spaces WHERE id=1').get();
    if (typeof row?.value !== 'string') throw new Error('无法读取空间目录');
    return directory(JSON.parse(row.value));
  }
  replace(expected: number, next: SpaceDirectory) {
    const value = directory(next);
    if (value.revision !== expected + 1) throw new Error('空间版本必须逐次增加');
    const result = this.database.prepare('UPDATE app_spaces SET revision=?,value=? WHERE id=1 AND revision=?').run(value.revision, JSON.stringify(value), expected);
    if (result.changes !== 1) throw new SpaceError(409, 'space_directory_changed', '空间列表已变化，请刷新后重试');
  }
  close() { this.database.close(); }
}

const hosts = new Map<string, SpaceHost>();
export function spacesHost() {
  const root = resolve(process.env.MOMO_APP_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.cwd(), 'MOMO-App'));
  let host = hosts.get(root);
  if (!host) {
    mkdirSync(root, { recursive: true });
    const storage = new SqliteSpaceStorage(join(root, 'host-config.sqlite3'));
    host = new SpaceHost(storage, {
      inventory: id => new CoreClient(hostConfig(id)).spaceAssets(id),
      remove: request => new CoreClient(hostConfig(request.source_id)).removeSpace(request),
    }, randomUUID);
    hosts.set(root, host);
  }
  return host;
}

export function coreForSpace(id?: string) {
  const host = spacesHost(); const selected = id ?? host.read().currentId;
  host.requireSpace(selected);
  return new CoreClient(hostConfig(selected));
}

export function coreForCancellation(id: string) {
  if (!spacesHost().read().spaces.some(space => space.id === id)) throw new SpaceError(404, 'space_not_found', '空间不存在');
  return new CoreClient(hostConfig(id));
}
