import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parameters, requestParameters, groupFromJson, parameterJson, requestParameterJson, requestFromJson } from '../../src/product/contracts/parameters';
import { readParameters, saveParameters, parametersForRequest } from '../../src/product/lib/server/parameters.server';
const id = '01900000-0000-7000-8000-000000000001';
const group = { id, name: '默认', temperature: null, topP: null, maxOutput: null };
test('request JSON exposes boolean stream without leaking it into group or provider extras', () => {
  assert.deepEqual(requestParameterJson(group, true), { stream: true });
  const edited = requestFromJson(group, true, { stream: false, temperature: 0.4, frequency_penalty: 0.2 });
  assert.equal(edited.stream, false);
  assert.deepEqual(requestParameterJson(edited.group, edited.stream), { frequency_penalty: 0.2, temperature: 0.4, stream: false });
  assert.deepEqual(requestParameters(edited.group), { temperature: 0.4, parameters: { frequency_penalty: 0.2 } });
  assert.equal(requestFromJson(group, false, {}).stream, false);
  for (const value of [null, 0, 'false']) assert.throws(() => requestFromJson(group, true, { stream: value }));
});
test('JSON edits share form fields, reject protocol control and preserve extra parameters across snapshots', () => {
  const updated = groupFromJson(group, { temperature: 0.4, top_p: 0.8, frequency_penalty: 0.2 });
  assert.equal(updated.temperature, 0.4);
  assert.equal(updated.maxOutput, null);
  assert.deepEqual(parameterJson(updated), { frequency_penalty: 0.2, temperature: 0.4, top_p: 0.8 });
  assert.deepEqual(requestParameters(updated), { temperature: 0.4, parameters: { frequency_penalty: 0.2, top_p: 0.8 } });
  assert.equal(groupFromJson(updated, {}).temperature, null);
  for (const field of ['model','messages','stream','api_key','tools'])
    assert.throws(() => groupFromJson(group, { [field]: 'invalid' }));
  assert.throws(() => groupFromJson(group, { max_output_tokens: 0 }));
  assert.throws(() => groupFromJson(group, { frequency_penalty: Number.NaN }));
});
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

test('stream changes apply only to new requests; retries retain their delivery mode', () => {
  process.env.MOMO_APP_DATA_DIR = mkdtempSync(join(tmpdir(), 'momo-stream-snapshot-'));
  const request = crypto.randomUUID(), space = crypto.randomUUID(), conversation = crypto.randomUUID();
  assert.equal(parametersForRequest(request, space, conversation, 'hello', undefined, false).stream, false);
  assert.equal(parametersForRequest(request, space, conversation, 'hello', undefined, true).stream, false);
  assert.equal(parametersForRequest(crypto.randomUUID(), space, conversation, 'next', undefined, true).stream, true);
});
