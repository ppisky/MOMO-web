import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parameters, requestParameters } from '../../src/product/contracts/parameters';
import { readParameters, saveParameters, parametersForRequest } from '../../src/product/lib/server/parameters.server';
const id = '01900000-0000-7000-8000-000000000001';
const group = { id, name: '默认', temperature: null, topP: null, maxOutput: null };
test('blank parameters are omitted; explicit zero sampling is preserved; output zero is rejected', () => {
  assert.deepEqual(requestParameters(group), {});
  assert.deepEqual(requestParameters({ ...group, temperature: 0, topP: 0, maxOutput: 256 }), {
    temperature: 0,
    parameters: { top_p: 0 },
    max_output_tokens: 256,
  });
  assert.throws(() => parameters({ revision: 0, selectedId: id, groups: [{ ...group, maxOutput: 0 }] }));
  assert.throws(() => parameters({ revision: 0, selectedId: id, groups: [{ ...group, temperature: '0' }] }));
  assert.throws(() => parameters({ revision: 0, selectedId: id, groups: [] }));
});
test('parameter changes apply to new requests while retries keep their original snapshot and identity', () => {
  process.env.MOMO_APP_DATA_DIR = mkdtempSync(join(tmpdir(), 'momo-parameters-test-'));
  const initial = readParameters();
  const a = crypto.randomUUID(),
    b = crypto.randomUUID(),
    space = crypto.randomUUID(),
    conversation = crypto.randomUUID();
  assert.equal(parametersForRequest(a, space, conversation, 'one').temperature, null);
  const changed = saveParameters({
    ...initial,
    groups: initial.groups.map((g) => ({ ...g, temperature: 0.7 })),
  });
  assert.equal(parametersForRequest(b, space, conversation, 'two').temperature, 0.7);
  assert.equal(parametersForRequest(a, space, conversation, 'one').temperature, null);
  assert.throws(() => parametersForRequest(a, space, conversation, 'different'));
  assert.throws(() => saveParameters(initial));
  assert.equal(readParameters().revision, changed.revision);
});

test('model edits affect new requests; retries and maintenance routes retain the originating selection', () => {
  process.env.MOMO_APP_DATA_DIR = mkdtempSync(join(tmpdir(), 'momo-model-snapshot-'));
  const initial = readParameters(),
    modelId = crypto.randomUUID(),
    providerId = crypto.randomUUID();
  const selected = saveParameters({ ...initial, groups: initial.groups.map((g) => ({ ...g, modelId })) });
  const catalog = {
    revision: 1,
    providers: [],
    models: [
      {
        id: modelId,
        provider_id: providerId,
        model_id: 'one',
        name: 'One',
        kind: 'chat' as const,
        context_window: 8192,
        max_output_tokens: null,
        reference: `configured_${'a'.repeat(64)}`,
      },
    ],
  };
  const request = crypto.randomUUID(),
    space = crypto.randomUUID(),
    conversation = crypto.randomUUID();
  const frozen = parametersForRequest(request, space, conversation, 'hello', catalog);
  assert.equal(frozen.modelReference, catalog.models[0]!.reference);
  assert.equal(frozen.modelRoutes?.memory_distillation?.model, frozen.modelReference);
  const updated = {
    ...catalog,
    models: catalog.models.map((m) => ({ ...m, reference: `configured_${'b'.repeat(64)}` })),
  };
  assert.deepEqual(parametersForRequest(request, space, conversation, 'hello', updated), frozen);
  assert.equal(
    parametersForRequest(crypto.randomUUID(), space, conversation, 'next', updated).modelReference,
    updated.models[0]!.reference,
  );
  assert.throws(() =>
    parametersForRequest(crypto.randomUUID(), space, conversation, 'bad', { ...catalog, models: [] }),
  );
  assert.throws(() =>
    parametersForRequest(crypto.randomUUID(), space, conversation, 'bad', {
      ...catalog,
      models: catalog.models.map((m) => ({ ...m, kind: 'embedding' as const })),
    }),
  );
  assert.equal(readParameters().revision, selected.revision);
});
