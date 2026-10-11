import { request as fetch } from '../../lib/transport';
import {
  character,
  conversation,
  list,
  message,
  record,
  text,
  uuid,
  type Character,
  type Conversation,
  type Message,
} from '../../contracts/core';
import { directory, type SpaceDirectory } from '../../contracts/spaces';
import { workspaceIdentity, type CoreIdentity } from '../../contracts/build';
export type Workspace = {
  spaces: SpaceDirectory;
  spaceId: string;
  characters: Character[];
  conversations: Conversation[];
  selected: Conversation | null;
  history: Message[];
  coreIdentity: CoreIdentity | null;
};
export async function api(path: string, input?: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    ...(input === undefined
      ? {}
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
    ...(signal ? { signal } : {}),
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw Error(
      typeof record(result).error === 'string'
        ? String(record(result).error)
        : `请求失败（${response.status}）`,
    );
  return result;
}
export function workspace(value: unknown): Workspace {
  const v = record(value);
  return {
    spaces: directory(v.spaces),
    spaceId: uuid(v.spaceId),
    coreIdentity: workspaceIdentity(v.coreIdentity),
    characters: list(v.characters, character),
    conversations: list(v.conversations, conversation),
    selected: v.selected === null ? null : conversation(v.selected),
    history: list(v.history, message),
  };
}
