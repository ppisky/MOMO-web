import type { ActionFunctionArgs } from '../lib/server/handler-types';
import { uuid } from '../contracts/core';
import { actionError, actionInput } from '../lib/server/actions.server';
import { coreForCancellation } from '../lib/server/spaces.server';
export async function action({ request }: ActionFunctionArgs) {
  try { const input = await actionInput(request); await coreForCancellation(uuid(input.spaceId)).cancel(uuid(input.requestId)); return Response.json({ ok: true }); }
  catch (error) { return actionError(error); }
}
