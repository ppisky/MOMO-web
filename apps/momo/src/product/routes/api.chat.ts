import type { ActionFunctionArgs } from '../lib/server/handler-types';
import { text, uuid } from '../contracts/core';
import { actionError, actionInput, core } from '../lib/server/actions.server';
import { parametersForRequest } from '../lib/server/parameters.server';
import { models } from '../contracts/models';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request);
    const content = text(input.input, 'input').trim();
    if (!content || content.length > 16000) throw new Error('消息长度不合法');
    const spaceId = uuid(input.spaceId),
      conversationId = uuid(input.conversationId),
      requestId = uuid(input.requestId);
    const client = core(spaceId);
    await client.requireConversation(conversationId);
    const response = await client.respond(
      conversationId,
      content,
      requestId,
      request.signal,
      parametersForRequest(
        requestId,
        spaceId,
        conversationId,
        content,
        models(await (await client.request('/v1/model-configuration')).json()),
      ),
    );
    if (!response.headers.get('Content-Type')?.includes('text/event-stream'))
      throw new Error('Core 未返回 SSE');
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return actionError(error);
  }
}
