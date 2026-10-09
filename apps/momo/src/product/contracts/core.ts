export type Character = { id: string; owner_space_id: string; name: string; character_markdown: string };
export type Conversation = { id: string; space_id: string; character_id: string | null; title: string };
export type Message = { id: string; conversation_id: string; role: 'user' | 'assistant' | 'system'; content: string; created_at: string };

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('接口返回了无效对象');
  return value as Record<string, unknown>;
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`无效字段：${field}`);
  return value;
}

export function uuid(value: unknown): string {
  const id = text(value, 'UUID');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('无效资源标识');
  return id.toLowerCase();
}

export function character(value: unknown): Character {
  const item = record(value);
  return { id: uuid(item.id), owner_space_id: uuid(item.owner_space_id), name: text(item.name, 'name'), character_markdown: text(item.character_markdown, 'character_markdown') };
}

export function conversation(value: unknown): Conversation {
  const item = record(value);
  return { id: uuid(item.id), space_id: uuid(item.space_id), character_id: item.character_id === null ? null : uuid(item.character_id), title: text(item.title, 'title') };
}

export function message(value: unknown): Message {
  const item = record(value);
  if (item.role !== 'user' && item.role !== 'assistant' && item.role !== 'system') throw new Error('无效消息角色');
  const createdAt = text(item.created_at, 'created_at');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('无效消息时间');
  return { id: uuid(item.id), conversation_id: uuid(item.conversation_id), role: item.role, content: text(item.content, 'content'), created_at: createdAt };
}

export function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 100000) throw new Error('无效资源列表');
  return value.map(parse);
}
