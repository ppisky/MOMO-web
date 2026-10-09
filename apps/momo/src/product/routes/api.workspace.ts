import type { LoaderFunctionArgs } from '../lib/server/handler-types';
import { uuid } from '../contracts/core';
import { core, actionError } from '../lib/server/actions.server';
import { spacesHost } from '../lib/server/spaces.server';
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const search = new URL(request.url).searchParams;
    const spaces = spacesHost().read();
    const spaceId = uuid(search.get('space') ?? spaces.currentId);
    const client = core(spaceId);
    const [version, characters, conversations] = await Promise.all([
      client.health(),
      client.characters(),
      client.conversations(),
    ]);
    const selected = conversations.find((value) => value.id === search.get('conversation')) ?? null;
    const history = selected ? await client.messages(selected.id) : [];
    return Response.json(
      { spaces, spaceId, version, characters, conversations, selected, history },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return actionError(error);
  }
}
