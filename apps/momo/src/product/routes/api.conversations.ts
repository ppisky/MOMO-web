import type { ActionFunctionArgs } from '../lib/server/handler-types';
import { uuid } from '../contracts/core';
import { actionError, actionInput, core } from '../lib/server/actions.server';
export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request);
    return Response.json(
      await core(uuid(input.spaceId)).createConversation(
        input.characterId == null ? null : uuid(input.characterId),
      ),
    );
  } catch (error) {
    return actionError(error);
  }
}
