import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { actionError, actionInput } from '../../src/product/lib/server/actions.server';
import { createApiMiddleware, type Routes } from '../../src/product/lib/server/http.server';

async function host(routes: Routes, run: (origin: string) => Promise<void>) {
  const middleware = createApiMiddleware(routes);
  const server = createServer((req, res) => middleware(req, res, () => { res.end('frontend'); }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('host restricts routes, methods, origin and Host before invoking business handlers', async () => {
  let calls = 0;
  const handler = () => { calls++; return Response.json({ ok: true }); };
  await host({ '/api/test': { loader: handler, action: handler } }, async origin => {
    assert.equal(await (await fetch(origin + '/')).text(), 'frontend');
    assert.equal((await fetch(origin + '/api/missing')).status, 404);
    assert.equal((await fetch(origin + '/api/test', { method: 'DELETE' })).status, 405);
    for (const headers of [{ Origin: 'http://evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      assert.equal((await fetch(origin + '/api/test', { headers })).status, 403);
    }
    assert.equal((await fetch(origin + '/api/test', { method: 'POST' })).status, 403);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      httpRequest(origin + '/api/test', { headers: { Host: 'evil.test' } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject).end();
    });
    assert.equal(status, 403); assert.equal(calls, 0);
    assert.equal((await fetch(origin + '/api/test')).status, 200);
    assert.equal((await fetch(origin + '/api/test', { method: 'POST', headers: { Origin: origin } })).status, 200);
    assert.equal(calls, 2);
  });
});

test('JSON request bytes and errors survive host adaptation; chunked input is bounded', { timeout: 5000 }, async () => {
  await host({ '/api/test': { action: async ({ request }) => {
    try { return Response.json(await actionInput(request)); } catch (error) { return actionError(error); }
  } } }, async origin => {
    const headers = { Origin: origin, 'Content-Type': 'application/json' };
    const response = await fetch(origin + '/api/test', { method: 'POST', headers, body: JSON.stringify({ input: '中文🌙' }) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { input: '中文🌙' });
    assert.equal((await fetch(origin + '/api/test', { method: 'POST', headers, body: 'x'.repeat(65537) })).status, 413);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(origin + '/api/test', { method: 'POST', headers }, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
      request.write('x'.repeat(40000)); request.end('x'.repeat(30000));
    });
    assert.equal(status, 413);
  });
});

test('SSE flushes before completion and disconnect cancels the upstream reader', { timeout: 5000 }, async () => {
  let aborted!: () => void;
  let cancelled!: () => void;
  const abortPromise = new Promise<void>(resolve => { aborted = resolve; });
  const cancelPromise = new Promise<void>(resolve => { cancelled = resolve; });
  await host({ '/api/stream': { loader: ({ request }) => {
    request.signal.addEventListener('abort', aborted, { once: true });
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: first\n\n')); },
      cancel() { cancelled(); },
    }), { headers: { 'Content-Type': 'text/event-stream' } });
  } } }, async origin => {
    const controller = new AbortController();
    const response = await fetch(origin + '/api/stream', { signal: controller.signal });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    assert.equal(new TextDecoder().decode((await response.body!.getReader().read()).value), 'data: first\n\n');
    controller.abort();
    await Promise.all([abortPromise, cancelPromise]);
  });
});
