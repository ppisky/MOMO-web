import type { IncomingMessage, ServerResponse } from 'node:http'
import * as cancel from '../../routes/api.cancel'
import * as characters from '../../routes/api.characters'
import * as chat from '../../routes/api.chat'
import * as conversations from '../../routes/api.conversations'
import * as models from '../../routes/api.models'
import * as parameters from '../../routes/api.parameters'
import * as resources from '../../routes/api.resources'
import * as spaces from '../../routes/api.spaces'
import * as workspace from '../../routes/api.workspace'
import type { HandlerArgs } from './handler-types'

type Handler = (args: HandlerArgs) => Response | Promise<Response>
export type Routes = Record<string, { loader?: Handler; action?: Handler }>
const routes: Routes = {
  '/api/workspace': workspace,
  '/api/spaces': spaces,
  '/api/characters': characters,
  '/api/conversations': conversations,
  '/api/resources': resources,
  '/api/parameters': parameters,
  '/api/models': models,
  '/api/chat': chat,
  '/api/cancel': cancel,
}

class InputTooLarge extends Error {}
function readBody(incoming: IncomingMessage, signal: AbortSignal): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    const clean = () => {
      incoming.off('data', data)
      incoming.off('end', end)
      incoming.off('error', error)
      signal.removeEventListener('abort', abort)
    }
    const error = (reason: unknown) => {
      clean()
      reject(reason)
    }
    const abort = () => error(new Error('client_disconnected'))
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > 65536) {
        error(new InputTooLarge())
        incoming.resume()
      } else chunks.push(chunk)
    }
    const end = () => {
      clean()
      resolve(new Uint8Array(Buffer.concat(chunks)))
    }
    incoming.on('data', data)
    incoming.once('end', end)
    incoming.once('error', error)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

/** Only local, same-origin, explicitly registered product APIs are exposed. */
export function createApiMiddleware(handlers: Routes = routes) {
  return (incoming: IncomingMessage, outgoing: ServerResponse, next: () => void) => {
    const pathname = (incoming.url ?? '').split('?')[0]
    if (pathname !== '/api' && !pathname?.startsWith('/api/')) return next()
    const fail = (status: number, code: string) => {
      outgoing.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      outgoing.end(JSON.stringify({ error: code, code }))
    }
    const port = incoming.socket.localPort
    const host = incoming.headers.host
    if (!host || !['127.0.0.1', 'localhost', '[::1]'].some((name) => host === `${name}:${port}`)) {
      return fail(403, 'host_denied')
    }
    const origin = `http://${host}`
    if (
      (incoming.headers.origin && incoming.headers.origin !== origin) ||
      incoming.headers['sec-fetch-site'] === 'cross-site'
    )
      return fail(403, 'origin_denied')
    const route = handlers[pathname]
    if (!route) return fail(404, 'route_not_found')
    const handler = incoming.method === 'GET' ? route.loader : incoming.method === 'POST' ? route.action : undefined
    if (!handler) return fail(405, 'method_not_allowed')
    if (incoming.method === 'POST' && incoming.headers.origin !== origin) return fail(403, 'origin_denied')
    if (Number(incoming.headers['content-length'] ?? 0) > 65536) return fail(413, 'input_too_large')

    const controller = new AbortController()
    const abort = () => controller.abort()
    incoming.once('aborted', abort)
    outgoing.once('close', abort)
    void (async () => {
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      try {
        const headers = new Headers()
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        }
        const init: RequestInit = {
          method: incoming.method,
          headers,
          signal: controller.signal,
        }
        if (incoming.method === 'POST') {
          init.body = (await readBody(incoming, controller.signal)) as BodyInit
        }
        const request = new Request(new URL(incoming.url ?? '/', origin), init)
        const response = await handler({ request, params: {}, context: {} })
        if (controller.signal.aborted) {
          await response.body?.cancel()
          return
        }
        outgoing.statusCode = response.status
        response.headers.forEach((value, key) => outgoing.setHeader(key, value))
        outgoing.setHeader('Cache-Control', 'no-store')
        outgoing.flushHeaders()
        reader = response.body?.getReader()
        const cancelReader = () => {
          void reader?.cancel().catch(() => {})
        }
        controller.signal.addEventListener('abort', cancelReader, { once: true })
        try {
          while (reader && !controller.signal.aborted) {
            const chunk = await reader.read()
            if (chunk.done) break
            if (!outgoing.write(chunk.value)) {
              await new Promise<void>((resolve) => {
                const done = () => {
                  outgoing.off('drain', done)
                  outgoing.off('close', done)
                  resolve()
                }
                outgoing.once('drain', done)
                outgoing.once('close', done)
              })
            }
          }
        } finally {
          controller.signal.removeEventListener('abort', cancelReader)
        }
        if (!outgoing.destroyed) outgoing.end()
      } catch (error) {
        if (!outgoing.destroyed) {
          if (outgoing.headersSent) outgoing.destroy()
          else if (error instanceof InputTooLarge) fail(413, 'input_too_large')
          else fail(500, 'web_host_failed')
        }
      } finally {
        await reader?.cancel().catch(() => {})
        reader?.releaseLock()
        incoming.off('aborted', abort)
        outgoing.off('close', abort)
      }
    })()
  }
}

export const middleware = createApiMiddleware()
