import type { ActionFunctionArgs } from '../lib/server/handler-types';
import { text, uuid } from '../contracts/core';
import { actionError, actionInput, core } from '../lib/server/actions.server';
export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request); const name = text(input.name, 'name').trim(); const persona = text(input.persona, 'persona').trim();
    if (!name || name.length > 120 || !persona || persona.length > 16000) throw new Error('角色内容不合法');
    return Response.json(await core(uuid(input.spaceId)).createCharacter(name, persona));
  } catch (error) { return actionError(error); }
}
