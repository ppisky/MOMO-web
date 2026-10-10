import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { groupFromJson, modelsForPurpose, parameterJson, parameters, requestFromJson, requestParameterJson, requestParameters } from '../../src/product/contracts/parameters';
import { parametersForRequest, readParameters, saveParameters } from '../../src/product/lib/server/parameters.server';
import { resolveParameters, validatePurposeModels } from '../../src/product/lib/server/resolve-parameters.server';

const id = '01900000-0000-7000-8000-000000000001';
const group = { id, name: '默认', temperature: null, topP: null, maxOutput: null };

test('purpose selections are type-filtered models, independent of dialogue groups and request JSON', () => {
  const providerId = crypto.randomUUID();
  const provider = { id: providerId, name: 'Fixture', protocol: 'openai' as const, base_url: 'http://127.0.0.1:9/v1', api_path: '', has_api_key: false };
  const catalog = { revision: 1, providers: [provider], models: (['chat', 'vision', 'embedding'] as const).map((kind, index) => ({
    id: crypto.randomUUID(), provider_id: providerId, model_id: kind, name: kind, kind,
    context_window: null, max_output_tokens: null, reference: `configured_${String(index).repeat(64)}`,
  })) };
  const [chat, vision, embedding] = catalog.models;
  assert.deepEqual(modelsForPurpose(catalog, 'vision'), [vision]);
  assert.deepEqual(modelsForPurpose(catalog, 'embedding'), [embedding]);
  assert.deepEqual(modelsForPurpose(catalog, 'semantic_graph_governance'), [chat, vision]);
  const config = parameters({ revision: 0, selectedId: id, groups: [{ ...group, modelId: chat!.id, temperature: 0.6, topP: 0.8, maxOutput: 100, parameters: { frequency_penalty: 0.4 } }], purposes: { vision: vision!.id }, embedding: { modelId: embedding!.id, dimension: 3 } });
  const resolved = resolveParameters(config, catalog);
  assert.deepEqual(resolved.modelRoutes?.vision, { model: vision!.reference });
  assert.deepEqual(resolved.modelRoutes?.memory_distillation, { model: chat!.reference });
  assert.deepEqual(resolved.modelRoutes?.semantic_graph_governance, { model: chat!.reference });
  assert.deepEqual(resolved.embedding, { model: embedding!.reference, dimension: 3 });
  assert.equal(resolved.parameters?.frequency_penalty, 0.4);
  assert.throws(() => validatePurposeModels({ ...config, purposes: { vision: chat!.id } }, catalog));
  assert.throws(() => validatePurposeModels({ ...config, purposes: { memory_distillation: embedding!.id } }, catalog));
  assert.throws(() => validatePurposeModels({ ...config, embedding: { modelId: chat!.id, dimension: 3 } }, catalog));
  for (const dimension of [0, 8193, 1.5]) assert.throws(() => parameters({ ...config, embedding: { modelId: embedding!.id, dimension } }));
  assert.equal(resolveParameters({ ...config, purposes: {}, embedding: null }, catalog).modelRoutes?.vision, undefined);
  assert.deepEqual(resolveParameters({ ...config, purposes: {}, embedding: null }, catalog).embedding, { model: null, dimension: null });
  const legacy = parameters({ ...config, purposes: { memory_distillation: id } });
  assert.equal(legacy.purposes?.memory_distillation, chat!.id);
});

test('embedding reference and dimension freeze for retries while later requests use the new configuration', () => {
  process.env.MOMO_APP_DATA_DIR = mkdtempSync(join(tmpdir(), 'momo-embedding-snapshot-'));
  const initial = readParameters(), providerId = crypto.randomUUID(), chatId = crypto.randomUUID(), embedId = crypto.randomUUID();
  const catalog = { revision: 1, providers: [{ id: providerId, name: 'Fixture', protocol: 'openai' as const, base_url: 'http://127.0.0.1:9/v1', api_path: '', has_api_key: false }], models: [
    { id: chatId, provider_id: providerId, model_id: 'chat', name: 'Chat', kind: 'chat' as const, context_window: null, max_output_tokens: null, reference: `configured_${'a'.repeat(64)}` },
    { id: embedId, provider_id: providerId, model_id: 'embed', name: 'Embed', kind: 'embedding' as const, context_window: null, max_output_tokens: null, reference: `configured_${'b'.repeat(64)}` },
  ] };
  const config = saveParameters({ ...initial, groups: initial.groups.map((g) => ({ ...g, modelId: chatId })), embedding: { modelId: embedId, dimension: 3 } });
  const request = crypto.randomUUID(), space = crypto.randomUUID(), conversation = crypto.randomUUID();
  const frozen = parametersForRequest(request, space, conversation, 'one', catalog);
  saveParameters({ ...config, embedding: { modelId: embedId, dimension: 4 } });
  assert.deepEqual(parametersForRequest(request, space, conversation, 'one', catalog), frozen);
  assert.equal(parametersForRequest(crypto.randomUUID(), space, conversation, 'two', catalog).embedding?.dimension, 4);
});
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
