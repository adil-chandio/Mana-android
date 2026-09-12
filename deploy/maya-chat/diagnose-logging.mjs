// Temporary build-side, read-only diagnostic. No upload or deployment path.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Blocked, WORKER, checkArtifact, checkBuild, checkLogging } from './upload-version.mjs';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => isObject(object) && Object.hasOwn(object, key) ? object[key] : undefined;
const shape = value => value === undefined ? 'missing' : value === null ? 'null' : isObject(value) ? 'object' : Array.isArray(value) ? 'array' : 'invalid';
const boolean = value => value === true ? 'true' : value === false ? 'false' : value === undefined ? 'missing' : value === null ? 'null' : 'invalid';
const list = value => value === undefined ? 'missing' : value === null ? 'null' : Array.isArray(value) ? (value.length ? 'nonempty' : 'empty') : 'invalid';
// Output consists exclusively of fixed field names and finite-state labels.
// Never serialize settings, identifiers, URLs, destination names or unknown keys.
export function projectLogging(settings) {
  const obs = own(settings, 'observability'), logs = own(obs, 'logs'), traces = own(obs, 'traces');
  let previousGuard = 'blocked';
  try { checkLogging(settings); previousGuard = 'pass'; } catch {}
  return {
    settings: shape(settings), observability: shape(obs), global_enabled: boolean(own(obs, 'enabled')),
    logs: shape(logs), logs_enabled: boolean(own(logs, 'enabled')),
    invocation_logs: boolean(own(logs, 'invocation_logs')), logs_persist: boolean(own(logs, 'persist')),
    log_destinations: list(own(logs, 'destinations')),
    traces: shape(traces), traces_enabled: boolean(own(traces, 'enabled')),
    traces_persist: boolean(own(traces, 'persist')), trace_destinations: list(own(traces, 'destinations')),
    logpush: boolean(own(settings, 'logpush')), tail_consumers: list(own(settings, 'tail_consumers')),
    previous_guard: previousGuard
  };
}
const SAFE_CODES = new Set(['ARTIFACT_MISMATCH', 'CLOUDFLARE_BUILD_ONLY', 'WRONG_BRANCH', 'UPLOAD_APPROVAL_REQUIRED',
  'COMMIT_ID_REQUIRED', 'BUILD_ACCOUNT_ID_REQUIRED', 'CLOUDFLARE_MANAGED_TOKEN_REQUIRED',
  'DIAGNOSTIC_DEADLINE', 'DIAGNOSTIC_API_ERROR', 'DIAGNOSTIC_RESPONSE_TOO_LARGE', 'DIAGNOSTIC_BAD_JSON']);
export function diagnosticErrorCode(error) {
  return error instanceof Blocked && SAFE_CODES.has(error.code) ? error.code : 'DIAGNOSTIC_FAILED';
}
export async function diagnoseLogging({ env, bytes, fetcher = globalThis.fetch, timeoutMs = 30000 }) {
  checkArtifact(bytes); const build = checkBuild(env);
  const url = `https://api.cloudflare.com/client/v4/accounts/${build.accountId}/workers/scripts/${WORKER}/script-settings`;
  const controller = new AbortController(); let reader, response, closed = false, reject;
  const deadline = Date.now() + timeoutMs;
  const check = () => { if (closed || Date.now() >= deadline) throw new Blocked('DIAGNOSTIC_DEADLINE'); };
  const cancelBody = () => {
    try { const pending = reader ? reader.cancel() : response?.body?.cancel(); pending?.catch(() => {}); } catch {}
  };
  const guard = new Promise((_, fail) => { reject = fail; });
  const timer = setTimeout(() => { closed = true; controller.abort(); cancelBody(); reject(new Blocked('DIAGNOSTIC_DEADLINE')); }, timeoutMs);
  try {
    return await Promise.race([guard, (async () => {
      check();
      // One fixed GET only. No cookies, redirect following, retries or write calls.
      response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit',
        headers: { Authorization: `Bearer ${build.token}`, Accept: 'application/json' }, signal: controller.signal });
      if (closed || Date.now() >= deadline) { cancelBody(); check(); }
      if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !response.body) {
        throw new Blocked('DIAGNOSTIC_API_ERROR');
      }
      reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true }); let text = '', size = 0;
      while (true) {
        const { done, value } = await reader.read(); check(); if (done) break;
        size += value.byteLength; if (size > 65536) throw new Blocked('DIAGNOSTIC_RESPONSE_TOO_LARGE');
        try { text += decoder.decode(value, { stream: true }); } catch { throw new Blocked('DIAGNOSTIC_BAD_JSON'); }
      }
      let envelope;
      try { envelope = JSON.parse(text + decoder.decode()); } catch { throw new Blocked('DIAGNOSTIC_BAD_JSON'); }
      if (envelope?.success !== true || !isObject(envelope.result)) throw new Blocked('DIAGNOSTIC_API_ERROR');
      check(); return projectLogging(envelope.result);
    })()]);
  } catch (error) {
    throw new Blocked(diagnosticErrorCode(error));
  } finally {
    closed = true; clearTimeout(timer); controller.abort(); cancelBody();
    try { reader?.releaseLock(); } catch {}
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const bytes = await readFile(new URL('worker-upload.mjs', import.meta.url));
    const report = await diagnoseLogging({ env: process.env, bytes });
    console.log('MAYA_LOGGING_DIAGNOSTIC_V1');
    for (const [field, state] of Object.entries(report)) console.log(`${field}=${state}`);
    console.log('READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
  } catch (error) {
    console.error(`${diagnosticErrorCode(error)}_READ_ONLY_NO_UPLOAD`); process.exitCode = 1;
  }
}
