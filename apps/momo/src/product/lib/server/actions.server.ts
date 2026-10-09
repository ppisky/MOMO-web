import { record } from '../../contracts/core';
import { CoreError } from './core.server';
import { coreForSpace } from './spaces.server';
import { SpaceError } from '../../features/spaces/host';

export async function actionInput(request: Request) {
  if (request.method !== 'POST') throw new CoreError(405, 'method_not_allowed');
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const nativeOrigin = (globalThis as typeof globalThis & { __MOMO_HOST_CONFIG?: { applicationOrigin?: string } }).__MOMO_HOST_CONFIG?.applicationOrigin;
  if (origin !== url.origin || !(nativeOrigin === 'https://ron.invalid' && url.origin === nativeOrigin) && !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) throw new CoreError(403, 'origin_denied');
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new CoreError(415, 'json_required');
  if (!request.body) throw new CoreError(400, 'json_required');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > 65536) throw new CoreError(413, 'input_too_large');
      chunks.push(result.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const input = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return record(JSON.parse(input));
}

export function core(spaceId?: string) { return coreForSpace(spaceId); }

export function actionError(error: unknown) {
  if (error instanceof SpaceError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  return Response.json({ error: error instanceof CoreError ? error.message : '请求未能完成，请检查 Core 和应用配置', code: error instanceof CoreError ? error.code : 'request_failed' }, { status: error instanceof CoreError ? error.status : 400 });
}
