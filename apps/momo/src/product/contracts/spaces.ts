import { record, text, uuid } from './core';

export type Space = { id: string; name: string };
export const assetLabels = {
  characters: '角色', conversations: '对话', messages: '消息', memories: '记忆', nsg_nodes: '语义网节点',
  nsg_candidates: '语义网候选', deleted_items: '最近删除项目', pending_reviews: '待审记忆', pending_turns: '待提取轮次',
  settings_overrides: '空间独立设置',
  external_conversations: '其他空间引用角色的对话',
} as const;
export type Assets = { space_id: string; revision: string } & Record<keyof typeof assetLabels, number>;
export type Disposition = { kind: 'migrate'; target_id: string } | { kind: 'delete_assets' };
export type Removal = { operation_id: string; source_id: string; expected_revision: string; disposition: Disposition };
export type Receipt = { operation_id: string; source_id: string; disposition: Disposition; assets: Assets };
export type SpaceDirectory = { revision: number; spaces: Space[]; currentId: string; pending: Removal | null };

function natural(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('空间数量或版本无效');
  return value;
}
export function spaceName(value: unknown) {
  const name = text(value, 'name').trim();
  if (!name || [...name].length > 60 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('空间名称需要 1–60 个字符');
  return name;
}
export function disposition(value: unknown): Disposition {
  const data = record(value);
  if (data.kind === 'migrate' && Object.keys(data).every(key => ['kind', 'target_id'].includes(key))) return { kind: 'migrate', target_id: uuid(data.target_id) };
  if (data.kind === 'delete_assets' && Object.keys(data).length === 1) return { kind: 'delete_assets' };
  throw new Error('必须明确选择迁移或删除资产');
}
export function assets(value: unknown): Assets {
  const data = record(value); const revision = text(data.revision, 'revision');
  if (!/^[0-9a-f]{64}$/.test(revision)) throw new Error('资产版本无效');
  const counts = Object.fromEntries(Object.keys(assetLabels).map(key => [key, natural(data[key])]));
  return { space_id: uuid(data.space_id), revision, ...counts } as Assets;
}
export function removal(value: unknown): Removal {
  const data = record(value); const revision = text(data.expected_revision, 'expected_revision');
  if (!/^[0-9a-f]{64}$/.test(revision)) throw new Error('资产版本无效');
  return { operation_id: uuid(data.operation_id), source_id: uuid(data.source_id), expected_revision: revision, disposition: disposition(data.disposition) };
}
export function receipt(value: unknown): Receipt {
  const data = record(value);
  return { operation_id: uuid(data.operation_id), source_id: uuid(data.source_id), disposition: disposition(data.disposition), assets: assets(data.assets) };
}
export function directory(value: unknown): SpaceDirectory {
  const data = record(value);
  if (!Array.isArray(data.spaces) || !data.spaces.length || data.spaces.length > 256) throw new Error('至少需要一个空间');
  const spaces = data.spaces.map(value => { const row = record(value); return { id: uuid(row.id), name: spaceName(row.name) }; });
  if (new Set(spaces.map(space => space.id)).size !== spaces.length) throw new Error('空间身份重复');
  const currentId = uuid(data.currentId); if (!spaces.some(space => space.id === currentId)) throw new Error('当前空间不存在');
  const pending = data.pending === null ? null : removal(data.pending);
  const targetId = pending?.disposition.kind === 'migrate' ? pending.disposition.target_id : null;
  if (pending && (!spaces.some(space => space.id === pending.source_id) || spaces.length < 2 || targetId && (targetId === pending.source_id || !spaces.some(space => space.id === targetId)))) throw new Error('待恢复操作的空间无效');
  return { revision: natural(data.revision), spaces, currentId, pending };
}
