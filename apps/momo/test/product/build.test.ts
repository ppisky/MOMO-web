import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coreIdentity, workspaceIdentity, RESPONSE_SCHEMA, CONTROL_SCHEMA } from '../../src/product/contracts/build.ts';

const revision = 'a'.repeat(40);
const payload = { core_version: '1.0.0', response_schema: RESPONSE_SCHEMA, control_schema: CONTROL_SCHEMA,
  build_info: { git_revision: revision, git_tag: 'v1.0.0-rc.6', dirty: false } };

test('Git build identity remains distinct from package and request schema versions', () => {
  const identity = coreIdentity(payload);
  assert.equal(identity.build?.gitRevision, revision);
  assert.equal(identity.build?.gitTag, 'v1.0.0-rc.6');
  assert.equal(identity.packageVersion, '1.0.0');
  assert.deepEqual(workspaceIdentity(identity), identity);
  assert.equal(coreIdentity({ ...payload, build_info: { ...payload.build_info, dirty: true } }).build?.dirty, true);
});

test('older Core and builds without Git are distinct and never invent a revision', () => {
  const legacy = coreIdentity({ core_version: '1.0.0' });
  assert.equal(legacy.metadataAvailable, false);
  assert.equal(legacy.build, null);
  const archive = coreIdentity({ ...payload, build_info: { git_revision: null, git_tag: null, dirty: null } });
  assert.equal(archive.metadataAvailable, true);
  assert.equal(archive.build, null);
  assert.deepEqual(workspaceIdentity(archive), archive);
});

test('invalid identity and incompatible request standards fail validation', () => {
  assert.throws(() => coreIdentity({ ...payload, response_schema: 'momo.responses/2.0' }));
  for (const change of [{git_revision: '1.0.0'}, {dirty: 'false'}, {git_tag: 'tag\nspoof'}, {git_revision: null}])
    assert.throws(() => coreIdentity({ ...payload, build_info: { ...payload.build_info, ...change } }));
});
