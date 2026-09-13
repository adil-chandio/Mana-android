// Temporary BUILD-SIDE read-only check. No Worker/browser import, upload or mutation.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Blocked, WORKER, checkArtifact, checkBuild, readUploadSource, activeDeployment, checkLogging } from './upload-version.mjs';
export const APPROVED_DIAGNOSTIC_PARENT = 'b2b8ceeb35effdd9c4be871f00dcacaa5a24a15d';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (v, k) => object(v) && Object.hasOwn(v, k) ? v[k] : undefined;
const shape = v => v === undefined ? 'missing' : v === null ? 'null' : Array.isArray(v) ? 'array' : ['string', 'boolean', 'number', 'object'].includes(typeof v) ? typeof v : 'invalid';
const count = n => n === 0 ? 'none' : n === 1 ? 'one' : 'multiple';
const boolean = v => v === undefined ? 'missing' : v === null ? 'null' : v === true ? 'true' : v === false ? 'false' : 'other';
const KNOWN = Object.freeze(['name', 'type', 'staging', 'gateway', 'namespace', 'account_id', 'id', 'text', 'remote', 'raw']);
// Only fixed keys and finite-state labels leave memory. Unknown names/values never do.
export function projectBinding(bindings) {
  const list = Array.isArray(bindings) ? bindings : [];
  const matches = list.filter(b => own(b, 'name') === 'AI');
  const ai = matches.length === 1 ? matches[0] : undefined;
  const keys = ai ? Object.keys(ai) : [];
  return {
    bindings_shape: shape(bindings), ai_matches: count(matches.length),
    ai_type: own(ai, 'type') === 'ai' ? 'ai' : own(ai, 'type') === undefined ? 'missing' : own(ai, 'type') === null ? 'null' : 'other',
    extra_fields: count(keys.filter(k => !['name', 'type'].includes(k)).length),
    unknown_fields: count(keys.filter(k => !KNOWN.includes(k)).length),
    staging: boolean(own(ai, 'staging')), gateway_shape: shape(own(ai, 'gateway')),
    namespace_shape: shape(own(ai, 'namespace')), account_id_shape: shape(own(ai, 'account_id')),
    id_shape: shape(own(ai, 'id')), text_shape: shape(own(ai, 'text')), remote: boolean(own(ai, 'remote')), raw: boolean(own(ai, 'raw')),
    strict_ai_guard: ai && own(ai, 'type') === 'ai' && keys.every(k => ['name', 'type'].includes(k)) ? 'pass' : 'blocked'
  };
}
// V3 narrow disclosure: one extra schema key name, never its value or nested keys.
// This is separate from the original finite-state projection above.
export function projectExtraFieldName(bindings) {
  const result = { extra_field_name_status: 'unavailable', extra_field_name: '-' };
  if (!Array.isArray(bindings)) return result;
  const matches = bindings.filter(b => own(b, 'name') === 'AI');
  if (matches.length !== 1 || own(matches[0], 'type') !== 'ai') return result;
  const keys = Object.keys(matches[0]).filter(k => !['name', 'type'].includes(k));
  const unknown = keys.filter(k => !KNOWN.includes(k));
  if (unknown.length === 0) return { ...result, extra_field_name_status: 'none' };
  if (keys.length !== 1 || unknown.length !== 1) return { ...result, extra_field_name_status: 'ambiguous' };
  const name = unknown[0];
  // Reject log injection, URLs/IDs, long or credential-labelled names. Do not
  // encode, hash, truncate or transform rejected data into another output channel.
  if (!/^[a-z][A-Za-z_]{0,47}$/.test(name)
    || /password|secret|token|credential|authorization|private|cookie/i.test(name)) {
    return { ...result, extra_field_name_status: 'withheld' };
  }
  return { extra_field_name_status: 'name_only', extra_field_name: name };
}
const requireThat = (condition, code) => { if (!condition) throw new Blocked(code); };
export function checkDiagnosticSource(env, source) {
  requireThat(source?.head === env.WORKERS_CI_COMMIT_SHA && source.head !== APPROVED_DIAGNOSTIC_PARENT
    && Array.isArray(source.parents) && source.parents.length === 1 && source.parents[0] === APPROVED_DIAGNOSTIC_PARENT,
  'BINDING_DIAGNOSTIC_SOURCE_NOT_APPROVED');
}
const SAFE_CODES = new Set(['ARTIFACT_MISMATCH', 'CLOUDFLARE_BUILD_ONLY', 'WRONG_BRANCH', 'UPLOAD_APPROVAL_REQUIRED',
  'COMMIT_ID_REQUIRED', 'BUILD_ACCOUNT_ID_REQUIRED', 'CLOUDFLARE_MANAGED_TOKEN_REQUIRED', 'BINDING_DIAGNOSTIC_SOURCE_NOT_APPROVED',
  'SINGLE_ACTIVE_VERSION_REQUIRED', 'LOGGING_MUST_BE_OFF', 'DIAGNOSTIC_DEADLINE', 'DIAGNOSTIC_API_ERROR',
  'DIAGNOSTIC_RESPONSE_TOO_LARGE', 'DIAGNOSTIC_BAD_JSON', 'DIAGNOSTIC_VERSION_MISMATCH', 'DIAGNOSTIC_CHAT_OFF_PAIRING_ON_REQUIRED',
  'DIAGNOSTIC_ACTIVE_VERSION_CHANGED', 'DIAGNOSTIC_BINDINGS_REQUIRE_REVIEW']);
export function bindingErrorCode(error) {
  return error instanceof Blocked && SAFE_CODES.has(error.code) ? error.code : 'BINDING_DIAGNOSTIC_FAILED';
}
export async function diagnoseBinding({ env, bytes, source, fetcher = globalThis.fetch, timeoutMs = 30000 }) {
  checkArtifact(bytes); const build = checkBuild(env); checkDiagnosticSource(env, source);
  const base = `https://api.cloudflare.com/client/v4/accounts/${build.accountId}/workers/scripts/${WORKER}`;
  const controller = new AbortController(); let reader, response, closed = false, reject;
  const deadline = Date.now() + timeoutMs;
  const check = () => requireThat(!closed && Date.now() < deadline, 'DIAGNOSTIC_DEADLINE');
  const cancelBody = () => { try { (reader ? reader.cancel() : response?.body?.cancel())?.catch(() => {}); } catch {} };
  const guard = new Promise((_, fail) => { reject = fail; });
  const timer = setTimeout(() => { closed = true; controller.abort(); cancelBody(); reject(new Blocked('DIAGNOSTIC_DEADLINE')); }, timeoutMs);
  // Private GET-only transport, no supplied URLs or methods. No cookies/retries/redirects.
  const get = async suffix => {
    check();
    requireThat(['/deployments', '/script-settings'].includes(suffix) || /^\/versions\/[a-f0-9-]{36}$/i.test(suffix), 'DIAGNOSTIC_API_ERROR');
    response = await fetcher(base + suffix, { method: 'GET', redirect: 'error', credentials: 'omit',
      headers: { Authorization: `Bearer ${build.token}`, Accept: 'application/json' }, signal: controller.signal });
    if (closed || Date.now() >= deadline) { cancelBody(); check(); }
    requireThat(response?.ok && response.headers.get('content-type')?.split(';')[0].trim() === 'application/json' && response.body, 'DIAGNOSTIC_API_ERROR');
    reader = response.body.getReader();
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true }); let text = '', size = 0;
      while (true) {
        const { done, value } = await reader.read(); check(); if (done) break;
        size += value.byteLength; requireThat(size <= 1_048_576, 'DIAGNOSTIC_RESPONSE_TOO_LARGE');
        try { text += decoder.decode(value, { stream: true }); } catch { throw new Blocked('DIAGNOSTIC_BAD_JSON'); }
      }
      let envelope;
      try { envelope = JSON.parse(text + decoder.decode()); } catch { throw new Blocked('DIAGNOSTIC_BAD_JSON'); }
      requireThat(envelope?.success === true && object(envelope.result), 'DIAGNOSTIC_API_ERROR');
      check(); return envelope.result;
    } finally { cancelBody(); try { reader.releaseLock(); } catch {} reader = undefined; }
  };
  try {
    return await Promise.race([guard, (async () => {
      const before = activeDeployment(await get('/deployments')); check();
      checkLogging(await get('/script-settings')); check();
      const version = await get(`/versions/${before.version}`); check();
      requireThat(version.id === before.version, 'DIAGNOSTIC_VERSION_MISMATCH');
      const bindings = version.resources?.bindings;
      requireThat(Array.isArray(bindings) && bindings.length === 9 && bindings.every(b => object(b) && typeof b.name === 'string')
        && new Set(bindings.map(b => b.name)).size === 9, 'DIAGNOSTIC_BINDINGS_REQUIRE_REVIEW');
      const flag = name => bindings.find(b => b.name === name);
      requireThat(flag('ENABLE_CHAT')?.type === 'plain_text' && flag('ENABLE_CHAT').text === 'false'
        && flag('PAIRING_ENABLED')?.type === 'plain_text' && flag('PAIRING_ENABLED').text === 'true', 'DIAGNOSTIC_CHAT_OFF_PAIRING_ON_REQUIRED');
      const report = { ...projectBinding(bindings), ...projectExtraFieldName(bindings) };
      requireThat(JSON.stringify(activeDeployment(await get('/deployments'))) === JSON.stringify(before), 'DIAGNOSTIC_ACTIVE_VERSION_CHANGED');
      checkLogging(await get('/script-settings')); check();
      return report;
    })()]);
  } catch (error) { throw new Blocked(bindingErrorCode(error)); }
  finally { closed = true; clearTimeout(timer); controller.abort(); cancelBody(); try { reader?.releaseLock(); } catch {} }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkBuild(process.env);
    const bytes = await readFile(new URL('worker-upload.mjs', import.meta.url));
    const report = await diagnoseBinding({ env: process.env, bytes, source: readUploadSource() });
    console.log('MAYA_AI_BINDING_READ_ONLY_V3');
    for (const [field, state] of Object.entries(report)) console.log(`${field}=${state}`);
    console.log('READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
  } catch (error) { console.error(`${bindingErrorCode(error)}_READ_ONLY_NO_UPLOAD`); process.exitCode = 1; }
}
