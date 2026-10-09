export type Character = {
  id: string;
  owner_space_id: string;
  name: string;
  character_markdown: string;
  version: string;
  author_name: string;
  author_url: string | null;
  user_markdown: string;
  opening_markdown: string | null;
};
export type Conversation = {
  id: string;
  space_id: string;
  character_id: string | null;
  title: string;
};
export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('接口返回了无效对象');
  return value as Record<string, unknown>;
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`无效字段：${field}`);
  return value;
}

export function uuid(value: unknown): string {
  const id = text(value, 'UUID');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new Error('无效资源标识');
  return id.toLowerCase();
}

export function character(value: unknown): Character {
  const item = record(value);
  return {
    id: uuid(item.id),
    owner_space_id: uuid(item.owner_space_id),
    name: text(item.name, 'name'),
    character_markdown: text(item.character_markdown, 'character_markdown'),
    version: text(item.version, 'version'),
    author_name: text(item.author_name, 'author_name'),
    author_url: item.author_url === null ? null : text(item.author_url, 'author_url'),
    user_markdown: text(item.user_markdown, 'user_markdown'),
    opening_markdown:
      item.opening_markdown === null ? null : text(item.opening_markdown, 'opening_markdown'),
  };
}

export function characterFields(input: Record<string, unknown>) {
  const fields: Record<string, string | null> = {};
  for (const key of ['version', 'author_name', 'author_url', 'user_markdown', 'opening_markdown']) {
    if (!(key in input)) continue;
    const value =
      input[key] === null && ['author_url', 'opening_markdown'].includes(key)
        ? null
        : text(input[key], key);
    if (value && value.length > (key.endsWith('markdown') ? 16000 : 500))
      throw Error('角色字段过长');
    if (key === 'author_name' && !value?.trim()) throw Error('作者不能为空');
    if (key === 'author_url' && value && !/^https?:\/\//i.test(value))
      throw Error('作者链接需要 http 或 https 地址');
    fields[key] = value;
  }
  return fields;
}

export function conversation(value: unknown): Conversation {
  const item = record(value);
  return {
    id: uuid(item.id),
    space_id: uuid(item.space_id),
    character_id: item.character_id === null ? null : uuid(item.character_id),
    title: text(item.title, 'title'),
  };
}

export function message(value: unknown): Message {
  const item = record(value);
  if (item.role !== 'user' && item.role !== 'assistant' && item.role !== 'system')
    throw new Error('无效消息角色');
  const createdAt = text(item.created_at, 'created_at');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('无效消息时间');
  return {
    id: uuid(item.id),
    conversation_id: uuid(item.conversation_id),
    role: item.role,
    content: text(item.content, 'content'),
    created_at: createdAt,
  };
}

export function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 100000) throw new Error('无效资源列表');
  return value.map(parse);
}
