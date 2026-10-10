import { record, text } from '../../contracts/core';

export type CoreEvent = { type: string; request_id: string; sequence: number; data: Record<string, unknown> };
export type Projection = { requestId: string; sequence: number; text: string; parts: Record<string, string>; terminal: 'completed' | 'failed' | 'cancelled' | null; embeddingDegraded?: boolean };

export function parseEvent(value: unknown): CoreEvent {
  const data = record(value);
  if (!Number.isSafeInteger(data.sequence) || typeof data.sequence !== 'number' || data.sequence < 0) throw new Error('无效事件序号');
  return { type: text(data.type, 'type'), request_id: text(data.request_id, 'request_id'), sequence: data.sequence, data };
}

export function initialProjection(requestId: string): Projection {
  return { requestId, sequence: -1, text: '', parts: {}, terminal: null };
}

export function projectEvent(state: Projection, event: CoreEvent): Projection {
  if (event.request_id !== state.requestId || event.sequence <= state.sequence || state.terminal) return state;
  const next = { ...state, sequence: event.sequence, parts: { ...state.parts } };
  if (event.type === 'response.output_text.delta' || event.type === 'response.output_text.done') {
    const outputIndex = event.data.output_index;
    const contentIndex = event.data.content_index;
    if (typeof outputIndex !== 'number' || typeof contentIndex !== 'number' || !Number.isSafeInteger(outputIndex) || !Number.isSafeInteger(contentIndex) || outputIndex < 0 || contentIndex < 0) throw new Error('无效文本索引');
    const key = `${outputIndex}:${contentIndex}`;
    next.parts[key] = event.type.endsWith('.delta') ? (next.parts[key] ?? '') + text(event.data.delta, 'delta') : text(event.data.text, 'text');
    next.text = Object.keys(next.parts).sort((a, b) => {
      const [ao = 0, ac = 0] = a.split(':').map(Number); const [bo = 0, bc = 0] = b.split(':').map(Number);
      return ao - bo || ac - bc;
    }).map(key => next.parts[key]).join('');
  }
  if (event.type === 'response.completed') {
    const response = record(event.data.response);
    if (response.status !== 'completed') throw new Error('完成事件缺少 completed 终态');
    if (typeof response.output_text === 'string') next.text = response.output_text;
    if (response.momo != null) {
      const metadata = record(response.momo)
      if (metadata.warnings !== undefined) {
        if (!Array.isArray(metadata.warnings) || metadata.warnings.some((warning) => typeof warning !== 'string'))
          throw Error('无效 Core 警告')
        next.embeddingDegraded = metadata.warnings.some((warning: string) =>
          /^embedding(?: index)? degraded:/.test(warning)
        )
      }
    }
    next.terminal = 'completed';
  } else if (event.type === 'response.failed' || event.type === 'error') next.terminal = event.data.error && record(event.data.error).code === 'cancelled' ? 'cancelled' : 'failed';
  else if (event.type === 'response.cancelled') next.terminal = 'cancelled';
  return next;
}

/** The protocol parser consumes bytes, independent of fetch, DOM and the host runtime. */
export async function* parseEventChunks(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<CoreEvent> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = ''; let data: string[] = []; let frameSize = 0;
  function* consume(fragment: string, final: boolean): Generator<CoreEvent> {
    pending += fragment;
    if (pending.length + frameSize > 1024 * 1024) throw new Error('流式事件超过大小限制');
    while (true) {
      const index = pending.search(/[\r\n]/);
      if (index < 0 || (!final && pending[index] === '\r' && index === pending.length - 1)) break;
      const line = pending.slice(0, index);
      const delimiter = pending[index] === '\r' && pending[index + 1] === '\n' ? 2 : 1;
      pending = pending.slice(index + delimiter);
      if (!line) {
        if (data.length) yield parseEvent(JSON.parse(data.join('\n')));
        data = []; frameSize = 0;
      } else if (line.startsWith('data:')) {
        const value = line.slice(5).replace(/^ /, ''); data.push(value); frameSize += value.length;
      }
    }
  }
  for await (const bytes of chunks) yield* consume(decoder.decode(bytes, { stream: true }), false);
  yield* consume(decoder.decode(), true);
  if (data.length || pending.startsWith('data:')) throw new Error('流式响应在事件中途断开');
}

/** Browser/development HTTP adapter; reader cleanup remains owned by the transport. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<CoreEvent> {
  const reader = body.getReader();
  async function* chunks() {
    while (true) {
      const result = await reader.read();
      if (result.done) return;
      yield result.value;
    }
  }
  try { yield* parseEventChunks(chunks()); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
