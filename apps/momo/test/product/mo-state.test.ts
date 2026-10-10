import assert from 'node:assert/strict';
import { test } from 'node:test';
import { injectionDescription, managedDdm, stateConstraints, stateManagement } from '../../src/product/contracts/mo-state';

const space = '00000000-0000-4000-8000-000000000101';
const other = '00000000-0000-4000-8000-000000000102';
const at = '2026-10-11T00:00:00Z';
const snapshot = () => ({ space_id: space, snapshot_id: 'snapshot-1', profile: 'closed_autonomous', created_at: at, snapshot_revision: 1, degraded: false, state_context: '[scene_constraint]\n- injury\n[epistemic_state]\n- hidden', scene: { status: 'active' }, state_audit: {} });
const operation = () => ({ operation_id: 'operation-1', event_type: 'response', phase: 'completed', created_at: at, updated_at: at, error: null, snapshot: snapshot(), response: null as unknown });
const report = () => ({ version: 1, space_id: space, runtime: { space_id: space, degraded: false, current_snapshot: snapshot() }, operations: [operation()] });
const response = () => ({ request_id: 'request-1', conversation_id: other, injection_status: 'active', warnings: [], state_section: { original_tokens: 100, injected_tokens: 40, truncated: true, omitted: false } });

test('MO State accepts old snapshots without inventing evidence or injection history', () => {
  const parsed = stateManagement(report(), space);
  assert.equal(parsed.current_snapshot?.records, null);
  assert.deepEqual(parsed.current_snapshot?.sources, []);
  assert.match(injectionDescription(parsed.operations[0]), /旧记录.*未记录/);
  assert.equal(stateManagement({ version: 1, space_id: space, runtime: { space_id: space, status: 'not_initialized' }, operations: [] }, space).initialized, false);
});

test('MO State rejects cross-space data, unsupported versions and invalid completion audit', () => {
  assert.throws(() => stateManagement(report(), other), /空间/);
  const runtime = report(); runtime.runtime.space_id = other;
  assert.throws(() => stateManagement(runtime, space), /空间/);
  const wrongSnapshot = report(); wrongSnapshot.operations[0]!.snapshot.space_id = other;
  assert.throws(() => stateManagement(wrongSnapshot, space), /空间/);
  assert.throws(() => stateManagement({ ...report(), version: 2 }, space), /版本/);
  assert.throws(() => stateManagement({ ...report(), operations: Array.from({ length: 21 }, operation) }, space), /数量/);
  const invalid = report(); invalid.operations[0]!.response = { ...response(), conversation_id: 'outside' };
  assert.throws(() => stateManagement(invalid, space));
  invalid.operations[0]!.response = { ...response(), state_section: { ...response().state_section, truncated: 1 } };
  assert.throws(() => stateManagement(invalid, space), /标记/);
});

test('injection display follows stored final context audit rather than current settings', () => {
  const wire = report(); const audit = response(); wire.operations[0]!.response = audit;
  const describe = () => injectionDescription(stateManagement(wire, space).operations[0]);
  assert.equal(describe(), '裁剪后参与对话 · 40 tokens');
  audit.state_section.omitted = true; assert.equal(describe(), '未进入最终上下文');
  audit.injection_status = 'shadow'; assert.equal(describe(), '仅观察，未注入对话');
  audit.injection_status = 'suppressed_degraded'; assert.match(describe(), /降级.*未注入/);
  wire.operations[0]!.response = null; wire.operations[0]!.phase = 'projected';
  assert.match(describe(), /未完成回复/);
});

test('state presentation preserves Core directives and DDM boundaries', () => {
  const parsed = stateConstraints('[STATE_CONTEXT:momo.state-context/1]\n[scene_constraint]\n- injury\n[ddm_constraints]\n- preserve agency\n[/STATE_CONTEXT]');
  assert.deepEqual(parsed.map((item) => item.lines), [['injury'], ['preserve agency']]);
  assert.equal(parsed[1]?.label, '角色侧写约束');
  assert.equal(managedDdm(null, space), null);
  const profile = { profile: { character_id: space, revision: 1, profile: 'logit_additive', dispositions: [{ id: 'care', description: 'Care', base_activation: 0.8, constraints: [] }] } };
  assert.equal(managedDdm(profile, space)?.dispositions[0]?.base, 0.8);
  assert.throws(() => managedDdm(profile, other), /身份/);
  profile.profile.dispositions[0]!.base_activation = Infinity;
  assert.throws(() => managedDdm(profile, space), /倾向/);
});
