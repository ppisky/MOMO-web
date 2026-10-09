import { directory, spaceName, type Assets, type Disposition, type Receipt, type Removal, type SpaceDirectory } from '../../contracts/spaces';

/** Host configuration only. The backing port performs an atomic CAS; no Core
 * business records, model credentials or filesystem paths cross this boundary. */
export interface SpaceStorage {
  read(): SpaceDirectory;
  replace(expectedRevision: number, value: SpaceDirectory): void;
}
export interface SpaceCore {
  inventory(id: string): Promise<Assets>;
  remove(request: Removal): Promise<Receipt>;
}
export class SpaceError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export class SpaceHost {
  constructor(private readonly storage: SpaceStorage, private readonly core: SpaceCore, private readonly newId: () => string) {}
  read() { return directory(this.storage.read()); }
  private requireRevision(expected: number) {
    const data = this.read();
    if (data.revision !== expected) throw new SpaceError(409, 'space_directory_changed', '空间列表已变化，请刷新后重试');
    if (data.pending) throw new SpaceError(409, 'space_removal_pending', '上一次空间操作仍需核对，请先继续处理');
    return data;
  }
  requireSpace(id: string) {
    const data = this.read();
    if (!data.spaces.some(space => space.id === id)) throw new SpaceError(404, 'space_not_found', '空间不存在或已删除');
    if (data.pending && (data.pending.source_id === id || data.pending.disposition.kind === 'migrate' && data.pending.disposition.target_id === id)) throw new SpaceError(409, 'space_removal_pending', '这个空间正在处理资产，请在空间设置中继续核对');
    return data;
  }
  private save(previous: SpaceDirectory, next: SpaceDirectory) {
    this.storage.replace(previous.revision, directory({ ...next, revision: previous.revision + 1 }));
    return this.read();
  }
  create(expected: number, name: unknown) {
    const data = this.requireRevision(expected);
    if (data.spaces.length >= 256) throw new SpaceError(409, 'space_limit', '空间数量已达上限');
    return this.save(data, { ...data, spaces: [...data.spaces, { id: this.newId(), name: spaceName(name) }] });
  }
  rename(expected: number, id: string, name: unknown) {
    const data = this.requireRevision(expected); this.requireSpace(id);
    return this.save(data, { ...data, spaces: data.spaces.map(space => space.id === id ? { ...space, name: spaceName(name) } : space) });
  }
  select(expected: number, id: string) {
    const data = this.requireRevision(expected); this.requireSpace(id);
    return this.save(data, { ...data, currentId: id });
  }
  async inventory(id: string) {
    this.requireSpace(id); const data = await this.core.inventory(id);
    if (data.space_id !== id) throw new Error('Core 返回了其他空间的资产');
    return data;
  }
  async remove(expected: number, sourceId: string, revision: string, choice: Disposition) {
    const data = this.requireRevision(expected); this.requireSpace(sourceId);
    if (data.spaces.length < 2) throw new SpaceError(409, 'last_space', '必须保留至少一个空间');
    if (choice.kind === 'migrate') {
      this.requireSpace(choice.target_id);
      if (choice.target_id === sourceId) throw new SpaceError(400, 'invalid_target', '请选择另一个空间');
    }
    const pending: Removal = { operation_id: this.newId(), source_id: sourceId, expected_revision: revision, disposition: choice };
    this.save(data, { ...data, pending });
    return this.resume();
  }
  async resume() {
    const data = this.read(); const pending = data.pending;
    if (!pending) return data;
    let result: Receipt;
    try { result = await this.core.remove(pending); }
    catch (error) {
      // These machine codes prove Core rejected the transition BEFORE intent.
      // Timeout, lost receipt and other conflicts keep the persisted operation.
      if (error instanceof Error && 'code' in error && ['space_assets_changed', 'space_response_pending', 'space_migration_conflict', 'space_busy'].includes(String(error.code))) {
        const latest = this.read();
        if (latest.pending?.operation_id === pending.operation_id) this.save(latest, { ...latest, pending: null });
      }
      throw error;
    }
    if (result.operation_id !== pending.operation_id || result.source_id !== pending.source_id || result.assets.revision !== pending.expected_revision || JSON.stringify(result.disposition) !== JSON.stringify(pending.disposition)) throw new Error('Core 的处理回执与删除意图不一致，已保留待核对状态');
    const latest = this.read();
    // Another window may already have reconciled the same receipt.
    if (!latest.pending && !latest.spaces.some(space => space.id === pending.source_id)) return latest;
    if (latest.pending?.operation_id !== pending.operation_id) throw new SpaceError(409, 'space_directory_changed', '操作状态已变化，请刷新');
    const spaces = latest.spaces.filter(space => space.id !== pending.source_id);
    if (!spaces.length) throw new Error('空间目录损坏，拒绝删除最后一个空间');
    const fallback = pending.disposition.kind === 'migrate' ? pending.disposition.target_id : spaces[0]!.id;
    return this.save(latest, { ...latest, spaces, currentId: latest.currentId === pending.source_id ? fallback : latest.currentId, pending: null });
  }
}
