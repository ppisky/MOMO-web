// Local, synthetic OpenAI-compatible endpoint for browser smoke checks.
// Never forwards requests or stores credentials/message content.
import { createServer } from 'node:http'

const origin = 'http://127.0.0.1:12209'
const requests = []
const server = createServer(async (req, res) => {
  if (req.headers.origin && req.headers.origin !== origin) {
    res.writeHead(403).end('Use the isolated browser smoke origin')
    return
  }
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  if (req.url === '/v1/models') {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ object: 'list', data: [{ id: 'momo-web-fixture', object: 'model', owned_by: 'local-test' }] }))
  }
  if (req.url === '/checks') {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify(requests))
  }
  if (req.url !== '/v1/chat/completions' || req.method !== 'POST') return res.writeHead(404).end()
  try {
    let input = ''
    for await (const chunk of req) {
      input += chunk
      if (input.length > 64 * 1024) return res.writeHead(413).end()
    }
    const body = JSON.parse(input)
    if (!Array.isArray(body.messages) || body.model !== 'momo-web-fixture') return res.writeHead(400).end()
    requests.push({ model: body.model, stream: body.stream === true, roles: body.messages.map((message) => message.role) })
    const common = { id: 'fixture-' + requests.length, created: Math.floor(Date.now() / 1000), model: body.model }
    const reply = '网页验收通过：浏览器已收到本地流式回复。'
    if (!body.stream) {
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ ...common, object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 12, total_tokens: 24 } }))
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const send = (delta, finish_reason = null) => res.write('data: ' + JSON.stringify({ ...common, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n')
    send({ role: 'assistant', content: '网页验收通过：' })
    const timer = setTimeout(() => {
      if (res.destroyed) return
      send({ content: '浏览器已收到本地流式回复。' })
      send({}, 'stop')
      res.end('data: [DONE]\n\n')
    }, 350)
    res.on('close', () => clearTimeout(timer))
  } catch {
    if (!res.headersSent) res.writeHead(400)
    res.end('Invalid test request')
  }
})
server.listen(19421, '127.0.0.1', () => {
  console.log('Synthetic API: http://127.0.0.1:19421/v1; browser origin: ' + origin)
})
