import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { initialProjection, parseEvent, projectEvent, readEvents } from '../../src/product/features/chat/stream.ts';

function bytes(source: string, chunkSize = 1) {
  const input = new TextEncoder().encode(source); let offset = 0;
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (offset === input.length) { controller.close(); return; }
    controller.enqueue(input.slice(offset, offset + chunkSize)); offset += Math.min(chunkSize, input.length - offset);
  } });
}

const event = (type: string, sequence: number, fields: Record<string, unknown> = {}, request_id = 'req_contract') => parseEvent({ type, sequence, request_id, ...fields });

test('frozen wire fixtures and original notices match their recorded source hashes', async () => {
  const base = new URL('../contracts/fixtures/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('sources.json', base), 'utf8')) as { files: { local: string; sha256: string }[]; notices: { path: string; sha256: string }[] };
  for (const entry of [...manifest.files.map(value => ({ path: value.local, sha256: value.sha256 })), ...manifest.notices]) {
    assert.equal(createHash('sha256').update(await readFile(new URL(entry.path, base))).digest('hex'), entry.sha256);
  }
});

test('frozen Core 1.0 SSE survives every byte boundary and produces authoritative text', async () => {
  const source = await readFile(new URL('../contracts/fixtures/response_stream.sse', import.meta.url), 'utf8');
  let state = initialProjection('req_contract'); let count = 0;
  for await (const value of readEvents(bytes(source))) { state = projectEvent(state, value); count++; }
  assert.equal(count, 9); assert.equal(state.text, 'Hello!'); assert.equal(state.terminal, 'completed');
});

test('UTF-8, split CRLF, multiline data and SSE comments', async () => {
  const source = ': keepalive\r\ndata: {"type":"response.output_text.delta",\r\ndata: "request_id":"req_contract","sequence":0,"output_index":0,"content_index":0,"delta":"你好🌙"}\r\n\r\n';
  const values = []; for await (const value of readEvents(bytes(source))) values.push(value);
  assert.equal(values.length, 1); assert.equal(projectEvent(initialProjection('req_contract'), values[0]!).text, '你好🌙');
});

test('duplicates, old sequences, other requests and post-terminal events cannot append twice', () => {
  let state = initialProjection('req_contract');
  const delta = event('response.output_text.delta', 3, { output_index: 0, content_index: 0, delta: 'Hi' });
  state = projectEvent(state, delta); assert.equal(projectEvent(state, delta), state);
  assert.equal(projectEvent(state, event('response.failed', 4, {}, 'other')), state);
  state = projectEvent(state, event('response.completed', 4, { response: { status: 'completed', output_text: 'Hi!' } }));
  assert.equal(state.text, 'Hi!'); assert.equal(projectEvent(state, event('response.failed', 9)), state);
});

test('text.done replaces partial text and multiple content slots retain index order', () => {
  let state = initialProjection('req_contract');
  state = projectEvent(state, event('response.output_text.delta', 0, { output_index: 1, content_index: 0, delta: 'B' }));
  state = projectEvent(state, event('response.output_text.delta', 1, { output_index: 0, content_index: 0, delta: 'wrong' }));
  state = projectEvent(state, event('response.output_text.done', 2, { output_index: 0, content_index: 0, text: 'A' }));
  assert.equal(state.text, 'AB');
});

test('failure and cancellation stay distinct; malformed completion cannot succeed', () => {
  assert.equal(projectEvent(initialProjection('req_contract'), event('response.failed', 0)).terminal, 'failed');
  assert.equal(projectEvent(initialProjection('req_contract'), event('response.cancelled', 0)).terminal, 'cancelled');
  assert.equal(projectEvent(initialProjection('req_contract'), event('response.failed', 0, { error: { code: 'cancelled' } })).terminal, 'cancelled');
  assert.throws(() => projectEvent(initialProjection('req_contract'), event('response.completed', 0, { response: { status: 'in_progress' } })));
  assert.throws(() => projectEvent(initialProjection('req_contract'), event('response.output_text.delta', 0, { output_index: -1, content_index: 0, delta: 'x' })));
  assert.throws(() => parseEvent({ type: 'error', request_id: 'x', sequence: NaN }));
});

test('truncation, invalid UTF-8, invalid JSON and oversized frames fail explicitly', async () => {
  for (const source of ['data: {"type":"error"}', 'data: invalid\n\n', 'data: ' + 'x'.repeat(1024 * 1024 + 1)]) {
    await assert.rejects(async () => { for await (const _ of readEvents(bytes(source, 16384))) {} });
  }
  await assert.rejects(async () => { for await (const _ of readEvents(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([0xff])); c.close(); } }))) {} });
});

test('HTTP reader is cancelled and unlocked after consumer exit or protocol failure', async () => {
  for (const malformed of [false, true]) {
    let cancellations = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(malformed ? 'data: invalid\n\n' :
          'data: {"type":"response.cancelled","request_id":"req_contract","sequence":0}\n\n'));
      },
      cancel() { cancellations++; },
    });
    const consume = async () => { for await (const _ of readEvents(body)) break; };
    if (malformed) await assert.rejects(consume); else await consume();
    assert.equal(cancellations, 1);
    assert.equal(body.locked, false);
  }
});
