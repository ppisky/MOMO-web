import type { ActionFunctionArgs, LoaderFunctionArgs } from '../lib/server/handler-types';
import { character, list, record, text, uuid } from '../contracts/core';
import { actionError, actionInput, core } from '../lib/server/actions.server';
import { CoreError } from '../lib/server/core.server';

const prompts = [
  'assistant',
  'vision_fallback',
  'roleplay_director',
  'memory_distillation',
  'semantic_graph_governance',
  'ddm_profile_generation',
];
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const query = new URL(request.url).searchParams;
    const spaceId = uuid(query.get('space'));
    const client = core(spaceId);
    switch (query.get('kind')) {
      case 'prompts':
        return Response.json(
          list(await (await client.request('/v1/prompt-spaces')).json(), (value) => {
            const p = record(value);
            if (!prompts.includes(text(p.id, 'id'))) throw Error('Unknown prompt space');
            return {
              id: text(p.id, 'id'),
              content: text(p.content, 'content'),
              source: text(p.source, 'source'),
              revision: text(p.revision, 'revision'),
            };
          }),
        );
      case 'runtime':
        return Response.json(
          record(await (await client.request(`/v1/runtime-settings/metadata?space_id=${spaceId}`)).json()),
        );
      case 'memory':
        return Response.json(
          list(await (await client.request(`/v1/memory/documents?space_id=${spaceId}`)).json(), record),
        );
      case 'memory-content': {
        const id = encodeURIComponent(text(query.get('id'), 'id'));
        return Response.json(
          await (await client.request(`/v1/memory/documents/${id}?space_id=${spaceId}`)).json(),
        );
      }
      case 'provenance':
        return Response.json(
          await (
            await client.request(
              `/v1/memory/provenance?space_id=${spaceId}&semantic_graph=${query.get('graph') === 'true'}`,
            )
          ).json(),
        );
      case 'nsg':
        return Response.json(
          list(
            await (
              await client.request('/v1/semantic-graph/nodes/list', {
                method: 'POST',
                body: JSON.stringify({ space_id: spaceId }),
              })
            ).json(),
            record,
          ),
        );
      default:
        throw new CoreError(404, 'resource_not_found');
    }
  } catch (error) {
    return actionError(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request);
    const spaceId = uuid(input.spaceId);
    const client = core(spaceId);
    switch (input.command) {
      case 'prompt-save':
      case 'prompt-reset': {
        const id = text(input.id, 'id');
        if (!prompts.includes(id)) throw Error('Unknown prompt');
        return Response.json(
          await (
            await client.request(
              `/v1/prompt-spaces/${id}`,
              input.command === 'prompt-reset'
                ? { method: 'DELETE' }
                : { method: 'PUT', body: JSON.stringify({ content: text(input.content, 'content') }) },
            )
          ).json(),
        );
      }
      case 'runtime-save': {
        if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0)
          throw Error('Invalid revision');
        const patch = record(input.patch);
        const allowed = ['history_window', 'runtime', 'request_overrides'];
        if (Object.keys(patch).some((key) => !allowed.includes(key))) throw Error('Invalid settings');
        return Response.json(
          await (
            await client.request(`/v1/runtime-settings/${spaceId}`, {
              method: 'PATCH',
              headers: { 'If-Match': String(input.revision) },
              body: JSON.stringify(patch),
            })
          ).json(),
        );
      }
      case 'character-save': {
        const id = uuid(input.id);
        const name = text(input.name, 'name').trim();
        const persona = text(input.persona, 'persona');
        if (!name || name.length > 120 || persona.length > 16000) throw Error('Invalid character');
        const old = record(await (await client.request(`/v1/characters/${id}`)).json());
        if (uuid(old.owner_space_id) !== spaceId) throw new CoreError(404, 'character_not_found');
        return Response.json(
          character(
            await (
              await client.request(`/v1/characters/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...old, name, character_markdown: persona }),
              })
            ).json(),
          ),
        );
      }
      case 'conversation-rename': {
        const id = uuid(input.id);
        const title = text(input.title, 'title').trim();
        if (!title || title.length > 200) throw Error('Invalid title');
        const all = list(
          await (await client.request(`/v1/conversations?space_id=${spaceId}`)).json(),
          record,
        );
        const old = all.find((item) => item.id === id && item.space_id === spaceId);
        if (!old) throw new CoreError(404, 'conversation_not_found');
        return Response.json(
          await (
            await client.request(`/v1/conversations/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ ...old, title }),
            })
          ).json(),
        );
      }
      default:
        throw new CoreError(400, 'unsupported_command');
    }
  } catch (error) {
    return actionError(error);
  }
}
