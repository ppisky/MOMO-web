import type { ActionFunctionArgs } from '../lib/server/handler-types'
import { record, text, uuid } from '../contracts/core'
import { actionError, actionInput, core } from '../lib/server/actions.server'
import { parametersForRequest } from '../lib/server/parameters.server'
import { models } from '../contracts/models'

export async function action({ request }: ActionFunctionArgs) {
  try {
    const input = await actionInput(request)
    if (input.stream !== undefined && typeof input.stream !== 'boolean') throw Error('stream 必须为 true 或 false')
    const content = text(input.input, 'input').trim()
    if (!content || content.length > 16000) throw new Error('消息长度不合法')
    const spaceId = uuid(input.spaceId),
      conversationId = uuid(input.conversationId),
      requestId = uuid(input.requestId)
    const client = core(spaceId)
    await client.requireConversation(conversationId)
    const parameters = parametersForRequest(
      requestId,
      spaceId,
      conversationId,
      content,
      models(await (await client.request('/v1/model-configuration')).json()),
      input.stream !== false
    )
    const response = await client.respond(conversationId, content, requestId, request.signal, parameters)
    let body: BodyInit | null = response.body
    if (parameters.stream === false) {
      if (!response.headers.get('Content-Type')?.includes('application/json')) throw Error('Core 未返回完整 JSON 响应')
      const completed = record(await response.json())
      if (completed.status !== 'completed' || typeof completed.output_text !== 'string')
        throw Error('Core 未返回有效完成响应')
      // Keep the UI lifecycle transport while delivering only the actual completed response.
      body = `data: ${JSON.stringify({ type: 'response.completed', request_id: requestId, sequence: 0, response: completed })}\n\n`
    } else if (!response.headers.get('Content-Type')?.includes('text/event-stream')) throw Error('Core 未返回 SSE')
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    return actionError(error)
  }
}
