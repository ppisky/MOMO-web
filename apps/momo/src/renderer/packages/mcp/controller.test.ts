import { afterEach, describe, expect, it, vi } from 'vitest'
import { settingsStore } from '@/stores/settingsStore'
import { MCPServer } from './controller'

interface RecordedRequest {
  url: string
  method: string
  body?: Record<string, unknown>
  headers: Headers
}

function recordRequest(input: RequestInfo | URL, init?: RequestInit): RecordedRequest {
  const url = input instanceof Request ? input.url : String(input)
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
  return { url, method, body, headers }
}

function modernResponse(
  request: Record<string, unknown>,
  result: Record<string, unknown>,
  options: { cacheable?: boolean } = {}
) {
  return Response.json({
    jsonrpc: '2.0',
    id: request.id,
    result: {
      resultType: 'complete',
      ...result,
      ...(options.cacheable ? { ttlMs: 0, cacheScope: 'private' } : {}),
      _meta: {
        'io.modelcontextprotocol/serverInfo': { name: 'modern-fixture', version: '1.0.0' },
      },
    },
  })
}

describe('MCPServer HTTP transport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps configurations without protocolMode on the legacy initialize flow', async () => {
    const requests: RecordedRequest[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const request = recordRequest(input, init)
        requests.push(request)

        if (request.method === 'GET') {
          return new Response(null, { status: 405, statusText: 'Method Not Allowed' })
        }

        const body = request.body
        if (body?.method === 'initialize') {
          return Response.json(
            {
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2025-11-25',
                capabilities: { tools: {} },
                serverInfo: { name: 'php-sdk', version: '0.7.0' },
              },
            },
            {
              headers: {
                'mcp-session-id': 'php-sdk-session',
              },
            }
          )
        }

        if (body?.method === 'notifications/initialized') {
          return new Response(null, { status: 202 })
        }

        if (body?.method === 'tools/list') {
          return Response.json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: [
                {
                  name: 'echo',
                  description: 'Echo the input text',
                  inputSchema: {
                    type: 'object',
                    properties: { text: { type: 'string' } },
                    required: ['text'],
                  },
                },
              ],
            },
          })
        }

        if (body?.method === 'tools/call') {
          return Response.json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{ type: 'text', text: 'hello' }],
            },
          })
        }

        return new Response(null, { status: 500 })
      })
    )

    const server = new MCPServer({
      id: 'legacy-builtin',
      name: 'Legacy Builtin',
      enabled: true,
      transport: {
        type: 'http',
        url: 'https://php-sdk.example.com/mcp',
      },
    })

    await server.start()

    expect(server.status).toEqual({ state: 'running' })
    expect(Object.keys(server.getAvailableTools())).toEqual(['echo'])
    const echoResult = await server
      .getAvailableTools()
      .echo.execute?.({ text: 'hello' }, { toolCallId: 'echo-call', messages: [] })
    expect(echoResult).toEqual({
      content: [{ type: 'text', text: 'hello' }],
      isError: false,
    })
    expect(requests[0].body).toMatchObject({
      method: 'initialize',
      params: { protocolVersion: '2025-11-25' },
    })
    expect(requests.map((request) => request.body?.method ?? request.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'GET',
      'tools/list',
      'tools/call',
    ])
    expect(requests.some((request) => request.body?.method === 'server/discover')).toBe(false)
    expect(requests.slice(1).map((request) => request.headers.get('mcp-protocol-version'))).toEqual([
      '2025-11-25',
      '2025-11-25',
      '2025-11-25',
      '2025-11-25',
    ])

    await server.stop()
  })

  it('uses the 2026-07-28 stateless wire for an auto HTTP server', async () => {
    const requests: RecordedRequest[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const request = recordRequest(input, init)
        requests.push(request)
        const body = request.body

        if (body?.method === 'server/discover') {
          return modernResponse(
            body,
            {
              supportedVersions: ['2026-07-28'],
              capabilities: { tools: {} },
            },
            { cacheable: true }
          )
        }

        if (body?.method === 'tools/list') {
          return modernResponse(
            body,
            {
              tools: [
                {
                  name: 'echo',
                  description: 'Echo the input text',
                  inputSchema: {
                    type: 'object',
                    properties: { text: { type: 'string' } },
                    required: ['text'],
                  },
                },
              ],
            },
            { cacheable: true }
          )
        }

        if (body?.method === 'tools/call') {
          return modernResponse(body, {
            content: [{ type: 'text', text: 'hello-modern' }],
            isError: false,
          })
        }

        return new Response(null, { status: 500 })
      })
    )

    const server = new MCPServer({
      id: 'modern-http',
      name: 'Modern HTTP',
      enabled: true,
      protocolMode: 'auto',
      transport: {
        type: 'http',
        url: 'https://modern.example.com/mcp',
      },
    })

    await server.start()

    expect(server.status).toEqual({ state: 'running' })
    expect(Object.keys(server.getAvailableTools())).toEqual(['echo'])
    const echoResult = await server
      .getAvailableTools()
      .echo.execute?.({ text: 'hello-modern' }, { toolCallId: 'echo-call', messages: [] })
    expect(echoResult).toEqual({
      _meta: {
        'io.modelcontextprotocol/serverInfo': { name: 'modern-fixture', version: '1.0.0' },
      },
      content: [{ type: 'text', text: 'hello-modern' }],
      isError: false,
    })
    const modelOutput = await server.getAvailableTools().echo.toModelOutput?.({
      toolCallId: 'echo-call',
      input: { text: 'hello-modern' },
      output: {
        content: [
          { type: 'text', text: 'hello-modern' },
          { type: 'image', data: 'aW1hZ2U=', mimeType: 'image/png' },
          { type: 'resource_link', uri: 'file:///result.txt', name: 'result.txt' },
        ],
      },
    })
    expect(modelOutput).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'hello-modern' },
        { type: 'image-data', data: 'aW1hZ2U=', mediaType: 'image/png' },
        {
          type: 'text',
          text: JSON.stringify({ type: 'resource_link', uri: 'file:///result.txt', name: 'result.txt' }),
        },
      ],
    })
    const structuredModelOutput = await server.getAvailableTools().echo.toModelOutput?.({
      toolCallId: 'structured-call',
      input: { text: 'hello-modern' },
      output: {
        content: [],
        structuredContent: { answer: 42 },
      },
    })
    expect(structuredModelOutput).toEqual({
      type: 'json',
      value: { answer: 42 },
    })
    expect(requests.map((request) => request.body?.method ?? request.method)).toEqual([
      'server/discover',
      'tools/list',
      'tools/call',
    ])

    for (const request of requests) {
      expect(request.headers.get('mcp-protocol-version')).toBe('2026-07-28')
      expect(request.headers.get('mcp-method')).toBe(request.body?.method)
      expect(request.body?.params).toMatchObject({
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': {
            name: 'chatbox-mcp-client',
            version: '1.0.0',
          },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      })
    }
    expect(requests[2].headers.get('mcp-name')).toBe('echo')
    expect(requests.some((request) => request.body?.method === 'initialize')).toBe(false)

    await server.stop()
  })

  it('falls back from discovery to the legacy Streamable HTTP handshake', async () => {
    const requests: RecordedRequest[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const request = recordRequest(input, init)
        requests.push(request)

        if (request.method === 'GET') {
          return new Response(null, { status: 405, statusText: 'Method Not Allowed' })
        }

        const body = request.body
        if (body?.method === 'server/discover') {
          return Response.json({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32601, message: 'Method not found' },
          })
        }

        if (body?.method === 'initialize') {
          return Response.json(
            {
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2025-11-25',
                capabilities: { tools: {} },
                serverInfo: { name: 'legacy-auto-fixture', version: '1.0.0' },
              },
            },
            { headers: { 'mcp-session-id': 'legacy-auto-session' } }
          )
        }

        if (body?.method === 'notifications/initialized') {
          return new Response(null, { status: 202 })
        }

        if (body?.method === 'tools/list') {
          return Response.json({
            jsonrpc: '2.0',
            id: body.id,
            result: { tools: [] },
          })
        }

        return new Response(null, { status: 500 })
      })
    )

    const server = new MCPServer({
      id: 'legacy-auto-http',
      name: 'Legacy Auto HTTP',
      enabled: true,
      protocolMode: 'auto',
      transport: {
        type: 'http',
        url: 'https://legacy-auto.example.com/mcp',
      },
    })

    await server.start()

    expect(server.status).toEqual({ state: 'running' })
    expect(requests.map((request) => request.body?.method ?? request.method)).toEqual([
      'server/discover',
      'initialize',
      'notifications/initialized',
      'GET',
      'tools/list',
    ])
    expect(requests[0].headers.get('mcp-protocol-version')).toBe('2026-07-28')
    expect(requests[0].headers.get('mcp-method')).toBe('server/discover')
    expect(requests[1].headers.get('mcp-protocol-version')).toBeNull()
    expect(requests.slice(2).map((request) => request.headers.get('mcp-protocol-version'))).toEqual([
      '2025-11-25',
      '2025-11-25',
      '2025-11-25',
    ])

    await server.stop()
  })

  it.each([
    { status: 401, statusText: 'Unauthorized' },
    { status: 500, statusText: 'Internal Server Error' },
  ])('does not treat HTTP $status as evidence for an SSE fallback', async ({ status, statusText }) => {
    const requests: RecordedRequest[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(recordRequest(input, init))
        return new Response(null, { status, statusText })
      })
    )

    const server = new MCPServer({
      id: `http-error-${status}`,
      name: `HTTP Error ${status}`,
      enabled: true,
      protocolMode: 'auto',
      transport: {
        type: 'http',
        url: `https://http-${status}.example.com/mcp`,
      },
    })

    await server.start()

    expect(server.status.state).toBe('idle')
    expect(server.status.error).toContain(String(status))
    // A 401 additionally triggers OAuth discovery (.well-known lookups and a registration attempt);
    // the MCP endpoint itself must only see the discover probe, never an SSE fallback.
    const endpointRequests = requests.filter((request) => request.url === `https://http-${status}.example.com/mcp`)
    expect(endpointRequests).toHaveLength(1)
    expect(endpointRequests[0].body?.method).toBe('server/discover')
    expect(endpointRequests[0].method).toBe('POST')
  })

  it('falls back to the initialize handshake when the probe is rejected with 401 despite a valid token', async () => {
    const origin = 'https://probe-401.example.com'
    const serverId = 'probe-401-http'
    settingsStore.getState().setSettings((draft) => {
      draft.mcp.oauth = {
        [serverId]: {
          clientInformation: { client_id: 'chatbox-client' },
          tokens: { access_token: 'stale-token', refresh_token: 'refresh-1', token_type: 'bearer' },
        },
      }
    })

    const requests: RecordedRequest[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const request = recordRequest(input, init)
        requests.push(request)
        const url = new URL(request.url)

        if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
          return Response.json({ resource: `${origin}/mcp`, authorization_servers: [origin] })
        }
        if (url.pathname.startsWith('/.well-known/oauth-authorization-server')) {
          return Response.json({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
          })
        }
        if (url.pathname === '/token') {
          return Response.json({ access_token: 'fresh-token', refresh_token: 'refresh-2', token_type: 'bearer' })
        }
        if (request.method === 'GET') {
          return new Response(null, { status: 405, statusText: 'Method Not Allowed' })
        }

        const body = request.body
        // Mirrors gateways that route by JSON-RPC method and never see the bearer on the probe
        if (body?.method === 'server/discover') {
          return Response.json({ error: 'Authorization header is missing' }, { status: 401 })
        }
        if (request.headers.get('authorization') !== 'Bearer fresh-token') {
          return Response.json({ error: 'Access token validation failed' }, { status: 401 })
        }
        if (body?.method === 'initialize') {
          return Response.json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-11-25',
              capabilities: { tools: {} },
              serverInfo: { name: 'probe-401-fixture', version: '1.0.0' },
            },
          })
        }
        if (body?.method === 'notifications/initialized') {
          return new Response(null, { status: 202 })
        }
        if (body?.method === 'tools/list') {
          return Response.json({ jsonrpc: '2.0', id: body.id, result: { tools: [] } })
        }
        return new Response(null, { status: 500 })
      })
    )

    const server = new MCPServer({
      id: serverId,
      name: 'Probe 401 HTTP',
      enabled: true,
      protocolMode: 'auto',
      transport: { type: 'http', url: `${origin}/mcp` },
    })

    try {
      await server.start()

      expect(server.status).toEqual({ state: 'running' })
      const rpcMethods = requests.filter((request) => request.body?.method).map((request) => request.body?.method)
      expect(rpcMethods).toEqual([
        'server/discover',
        'server/discover',
        'initialize',
        'notifications/initialized',
        'tools/list',
      ])
      expect(requests.some((request) => request.url === `${origin}/token`)).toBe(true)
      expect(settingsStore.getState().mcp.oauth?.[serverId]?.tokens?.access_token).toBe('fresh-token')
      await server.stop()
    } finally {
      settingsStore.getState().setSettings((draft) => {
        draft.mcp.oauth = undefined
      })
    }
  })

  it('preserves the Streamable HTTP error when the legacy SSE fallback also fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return new Response(null, { status: 405, statusText: 'Method Not Allowed' })
        }

        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '2099-01-01',
            capabilities: {},
            serverInfo: { name: 'future-server', version: '1.0.0' },
          },
        })
      })
    )

    const server = new MCPServer({
      id: 'future-legacy-server',
      name: 'Future Legacy Server',
      enabled: true,
      transport: {
        type: 'http',
        url: 'https://future.example.com/mcp',
      },
    })

    await server.start()

    expect(server.status.state).toBe('idle')
    expect(server.status.error).toContain(
      "Streamable HTTP connection failed: Server's protocol version is not supported: 2099-01-01"
    )
    expect(server.status.error).toContain('Legacy SSE fallback failed: MCP SSE Transport Error: 405 Method Not Allowed')
  })
})

describe('browser MCP transport boundary', () => {
  it.each(['auto', 'legacy'] as const)('rejects local stdio in %s mode', async (protocolMode) => {
    const server = new MCPServer({
      id: 'local',
      name: 'Local',
      enabled: true,
      protocolMode,
      transport: { type: 'stdio', command: 'must-not-execute', args: [] },
    })
    await server.start()
    expect(server.status).toMatchObject({ state: 'idle' })
    expect(JSON.stringify(server.status)).toContain('unavailable in the browser')
  })
})
