import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotAIBinding, InvalidAIMetadata } from './ai-binding-snapshot.mjs';
const ai = project => ({ name: 'AI', type: 'ai', project });
const rejects = value => assert.throws(() => snapshotAIBinding(value), error => error instanceof InvalidAIMetadata && error.message === 'AI_METADATA_REQUIRES_REVIEW');
const canary = 'PRIVATE_PROJECT_VALUE_NEVER_PRINT';
for (const value of [null, false, true, '', canary, 123, 1.25, { id: canary, nested: { z: false, a: null } }, [null, canary, { id: canary }]]) {
  test('opaque JSON metadata is detached and preserved without semantic assumptions: ' + (value === null ? 'null' : typeof value), () => {
    const input = ai(value), before = structuredClone(input), copy = snapshotAIBinding(input);
    assert.deepEqual(copy, before); assert.deepEqual(input, before); assert.notEqual(copy, input);
    if (value && typeof value === 'object') assert.notEqual(copy.project, value);
  });
}
test('project absence and explicit null remain distinct', () => {
  const absent = snapshotAIBinding({ type: 'ai', name: 'AI' }), present = snapshotAIBinding(ai(null));
  assert(!Object.hasOwn(absent, 'project')); assert(Object.hasOwn(present, 'project'));
  assert.notEqual(JSON.stringify(absent), JSON.stringify(present));
});
test('object key order canonicalizes at every level but array order remains significant', () => {
  const a = ai({ z: [{ b: 2, a: 1 }], a: { y: 2, x: 1 } });
  const b = { project: { a: { x: 1, y: 2 }, z: [{ a: 1, b: 2 }] }, type: 'ai', name: 'AI' };
  assert.equal(JSON.stringify(snapshotAIBinding(a)), JSON.stringify(snapshotAIBinding(b)));
  assert.notEqual(JSON.stringify(snapshotAIBinding(ai([1, 2]))), JSON.stringify(snapshotAIBinding(ai([2, 1]))));
});
test('nested values, types, missing fields and names cannot collide in comparison', () => {
  const variants = [null, false, 'false', 0, '0', {}, [], { a: null }, { b: null }, [false], [null], { a: [] }, { a: {} }];
  assert.equal(new Set(variants.map(v => JSON.stringify(snapshotAIBinding(ai(v))))).size, variants.length);
});
test('new AI root options remain unreviewed even if project is known', () => {
  for (const name of ['staging', 'raw', 'gateway', 'remote', 'namespace', 'account_id', 'unknown']) rejects({ ...ai(null), [name]: false });
});
test('wrong binding name or type, malformed root and inherited required fields are refused', () => {
  for (const value of [null, [], false, 'ai', {}, { name: 'OTHER', type: 'ai' }, { name: 'AI', type: 'inherit' },
    Object.assign(Object.create({ name: 'AI', type: 'ai' }), { project: null })]) rejects(value);
});
test('non-JSON, nonfinite and lossy negative zero metadata rejected', () => {
  for (const value of [undefined, NaN, Infinity, -Infinity, -0, 1n, Symbol('private'), () => canary, new Date(), new Map(), new Set()]) rejects(ai(value));
});
test('accessors and toJSON are never invoked', () => {
  let calls = 0;
  const project = Object.defineProperty({}, 'private', { enumerable: true, get() { calls++; return canary; } });
  rejects(ai(project));
  rejects(ai({ toJSON() { calls++; return canary; } }));
  const root = Object.defineProperty({ name: 'AI', type: 'ai' }, 'project', { enumerable: true, get() { calls++; return canary; } });
  rejects(root); assert.equal(calls, 0);
});
test('cycles are bounded and error never contains metadata', () => {
  const value = { private: canary }; value.self = value; rejects(ai(value));
});
test('depth, node and UTF-8 byte caps fail closed', () => {
  let deep = null; for (let i = 0; i < 9; i++) deep = { child: deep };
  for (const value of [deep, Array(513).fill(null), Object.fromEntries(Array.from({ length: 513 }, (_, i) => ['k' + i, null])),
    'x'.repeat(16385), 'é'.repeat(9000), { a: 'x'.repeat(9000), b: 'x'.repeat(9000) }]) rejects(ai(value));
});
test('sparse arrays, extra array properties, symbols and hidden data refused', () => {
  const extra = [1]; extra.private = canary;
  const symbol = { [Symbol('private')]: canary };
  const hidden = Object.defineProperty({}, 'private', { value: canary });
  for (const value of [Array(2), extra, symbol, hidden]) rejects(ai(value));
});
test('prototype-like JSON keys remain own data without prototype pollution', () => {
  const value = JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"x":1}}}');
  const copy = snapshotAIBinding(ai(value)); assert.deepEqual(copy.project, value);
  assert.equal({}.polluted, undefined); assert.equal({}.x, undefined);
});
