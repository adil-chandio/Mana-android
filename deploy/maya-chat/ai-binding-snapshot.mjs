// Build-side comparison only. Opaque metadata is never logged or sent in uploads.
// Do not infer project semantics or turn response metadata into configuration.
export class InvalidAIMetadata extends Error {
  constructor() { super('AI_METADATA_REQUIRES_REVIEW'); }
}
const fail = () => { throw new InvalidAIMetadata(); };
export function snapshotAIBinding(binding) {
  // The extra field name was observed in owner V3 evidence. Nothing else added.
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)
    || !Object.hasOwn(binding, 'name') || !Object.hasOwn(binding, 'type')
    || Object.keys(binding).some(k => !['name', 'type', 'project'].includes(k))) fail();
  let nodes = 0;
  const walk = (value, depth) => {
    if (++nodes > 512 || depth > 8) fail();
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') { if (value.length > 16384) fail(); return value; }
    if (typeof value === 'number') { if (!Number.isFinite(value) || Object.is(value, -0)) fail(); return value; }
    if (!value || typeof value !== 'object' || Object.getOwnPropertySymbols(value).length) fail();
    const proto = Object.getPrototypeOf(value);
    const array = Array.isArray(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail();
    const names = Object.getOwnPropertyNames(value);
    if (array && (value.length > 512 || names.length !== value.length + 1)) fail();
    if (names.length > 513) fail();
    const result = array ? [] : Object.create(null);
    for (const key of (array ? names.filter(k => k !== 'length') : names).sort()) {
      if (key.length > 16384 || array && !/^(0|[1-9]\d*)$/.test(key)) fail();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
      result[key] = walk(descriptor.value, depth + 1);
    }
    return result;
  };
  const normalized = walk(binding, 0);
  if (normalized.name !== 'AI' || normalized.type !== 'ai') fail();
  const text = JSON.stringify(normalized);
  if (Buffer.byteLength(text, 'utf8') > 16384) fail();
  // Return a detached canonical JSON snapshot, never a reference to provider data.
  return JSON.parse(text);
}
