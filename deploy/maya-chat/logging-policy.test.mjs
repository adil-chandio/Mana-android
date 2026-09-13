import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loggingOffRepresentation } from './logging-policy.mjs';
import { checkLogging, legacyCheckLogging } from './upload-version.mjs';
const canonical = () => ({ observability: null, logpush: false, tail_consumers: null });
test('exact live null response passes supported normalization while frozen old predicate still blocks', () => {
  assert.equal(loggingOffRepresentation(canonical()), 'null-disabled');
  assert.doesNotThrow(() => checkLogging(canonical())); assert.throws(() => legacyCheckLogging(canonical()), /LOGGING_MUST_BE_OFF/);
});
test('explicit OFF and serialized empty lists are supported without mutating input', () => {
  for (const observability of [null, { enabled: false }, { enabled: false, logs: { enabled: false }, traces: { enabled: false } },
    { enabled: false, head_sampling_rate: 1, redact_query_string: false,
      logs: { enabled: false, invocation_logs: true, persist: true, destinations: null },
      traces: { enabled: false, persist: true, head_sampling_rate: 1, destinations: [] } }]) {
    for (const tail_consumers of [null, []]) for (const streaming_tail_consumers of [null, []]) {
      const settings = { observability, logpush: false, tail_consumers, streaming_tail_consumers, tags: ['synthetic-preserved-tag'] };
      const before = structuredClone(settings); assert.notEqual(loggingOffRepresentation(settings), 'blocked'); assert.deepEqual(settings, before);
    }
  }
});
for (const observability of [undefined, true, false, 'false', 'null', 0, [], {}, { enabled: 'false' }, { enabled: null },
  { enabled: true }, { enabled: false, logs: null }, { enabled: false, logs: false }, { enabled: false, logs: [] },
  { enabled: false, logs: { enabled: true } }, { enabled: false, traces: { enabled: true } },
  { enabled: false, logs: { enabled: 'false' } }, { enabled: false, traces: { enabled: null } },
  { enabled: false, other_telemetry: true }]) {
  test('malformed, missing or enabled observability never passes', () => {
    assert.equal(loggingOffRepresentation({ ...canonical(), observability }), 'blocked');
  });
}
for (const field of ['observability','logpush','tail_consumers']) test(`missing ${field} is not treated as disabled`, () => {
  const value = canonical(); delete value[field]; assert.equal(loggingOffRepresentation(value), 'blocked');
});
test('null Logpush, truthy strings, missing fields and inherited data are refused', () => {
  for (const logpush of [undefined, null, 'false', 0, true, {}, []]) assert.equal(loggingOffRepresentation({ ...canonical(), logpush }), 'blocked');
  for (const value of [null, undefined, [], 'off', Object.create(canonical())]) assert.equal(loggingOffRepresentation(value), 'blocked');
});
for (const field of ['tail_consumers','streaming_tail_consumers']) test(`${field} must be absent-allowed or a null/empty list, never a consumer or malformed value`, () => {
  for (const value of [undefined, false, 'null', {}, [{ service: 'private' }], ['private']]) {
    assert.equal(loggingOffRepresentation({ ...canonical(), [field]: value }), 'blocked');
  }
});
test('unknown root fields are not silently ignored by the security check', () => {
  assert.equal(loggingOffRepresentation({ ...canonical(), future_telemetry: true }), 'blocked');
});
test('nested exports, malformed metadata and channel overrides are refused even under global OFF', () => {
  for (const channel of ['logs','traces']) {
    for (const value of [{ destinations: ['private'] }, { destinations: {} }, { persist: 'false' }, { head_sampling_rate: NaN },
      { head_sampling_rate: -1 }, { head_sampling_rate: 2 }, { unknown_telemetry: true }]) {
      assert.equal(loggingOffRepresentation({ ...canonical(), observability: { enabled: false, [channel]: value } }), 'blocked');
    }
  }
  assert.equal(loggingOffRepresentation({ ...canonical(), observability: { enabled: false, logs: { invocation_logs: 'false' } } }), 'blocked');
  assert.equal(loggingOffRepresentation({ ...canonical(), observability: { enabled: false, traces: { propagation_policy: 'private' } } }), 'blocked');
});
test('sampling zero cannot disguise enabled telemetry', () => {
  for (const obs of [{ enabled: true, head_sampling_rate: 0 }, { enabled: false, logs: { enabled: true, head_sampling_rate: 0 } },
    { enabled: false, traces: { enabled: true, head_sampling_rate: 0 } }]) {
    assert.equal(loggingOffRepresentation({ ...canonical(), observability: obs }), 'blocked');
  }
});
test('active pipeline is guarded inheritance upload, with all regression tests retained', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url)));
  assert.equal(pkg.scripts.upload, 'npm run check && node upload-version.mjs');
  assert.equal(pkg.scripts.test, 'node --test upload.test.mjs diagnostic.test.mjs repair.test.mjs logging-policy.test.mjs binding-diagnostic.test.mjs ai-binding-snapshot.test.mjs');
  const policy = readFileSync(new URL('logging-policy.mjs', import.meta.url), 'utf8');
  assert(!policy.includes('fetch(')); assert(!policy.includes('console.'));
});
