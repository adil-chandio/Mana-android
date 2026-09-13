// Temporary, owner-approved logging-OFF repair. Never uploads Worker code.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Blocked, WORKER, checkArtifact, checkBuild, activeDeployment } from './upload-version.mjs';
import { projectLogging } from './diagnose-logging.mjs';
export const APPROVED_PARENT = '98bd0d37e2ca06c9d4d23139c31ac1d88697157e';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const empty = value => Array.isArray(value) && value.length === 0;
const optionalEmpty = value => value === undefined || value === null || empty(value);
const requireThat = (value, code) => { if (!value) throw new Blocked(code); };
// Fixed documented JSON PATCH; only false values and empty destination lists.
// Do not echo any existing settings, tags, variables, bindings or secrets into it.
const PATCH_BODY = JSON.stringify({
  logpush: false,
  tail_consumers: [],
  observability: {
    enabled: false,
    logs: { enabled: false, invocation_logs: false, persist: false, destinations: [] },
    traces: { enabled: false, persist: false, destinations: [] }
  }
});
export function checkRepairSource(env, source) {
  requireThat(source?.head === env.WORKERS_CI_COMMIT_SHA && source?.parents?.length === 1
    && source.parents[0] === APPROVED_PARENT, 'REPAIR_SOURCE_NOT_APPROVED');
}
// Do not silently reinterpret the diagnosed null value as an OFF boolean.
export function explicitOff(settings) {
  const obs = settings?.observability;
  return object(settings) && object(obs) && obs.enabled === false && settings.logpush === false
    && empty(settings.tail_consumers) && optionalEmpty(settings.streaming_tail_consumers)
    && object(obs.logs) && obs.logs.enabled === false && obs.logs.invocation_logs === false
    && obs.logs.persist === false && empty(obs.logs.destinations)
    && object(obs.traces) && obs.traces.enabled === false && obs.traces.persist === false && empty(obs.traces.destinations);
}
function observedNullState(settings) {
  return object(settings) && settings.observability === null && settings.logpush === false
    && settings.tail_consumers === null && optionalEmpty(settings.streaming_tail_consumers);
}
function projection(settings) {
  const v = settings?.streaming_tail_consumers;
  return { ...projectLogging(settings), streaming_tail_consumers:
    v === undefined ? 'missing' : v === null ? 'null' : Array.isArray(v) ? (v.length ? 'nonempty' : 'empty') : 'invalid' };
}
const SAFE_CODES = new Set(['ARTIFACT_MISMATCH','CLOUDFLARE_BUILD_ONLY','WRONG_BRANCH','UPLOAD_APPROVAL_REQUIRED',
  'COMMIT_ID_REQUIRED','BUILD_ACCOUNT_ID_REQUIRED','CLOUDFLARE_MANAGED_TOKEN_REQUIRED','SINGLE_ACTIVE_VERSION_REQUIRED',
  'REPAIR_SOURCE_NOT_APPROVED','REPAIR_DEADLINE','REPAIR_API_ERROR','REPAIR_RESPONSE_TOO_LARGE','REPAIR_BAD_JSON',
  'REPAIR_UNEXPECTED_SETTINGS','REPAIR_DEPLOYMENT_CHANGED','REPAIR_OFF_NOT_VERIFIED','REPAIR_WRITE_DENIED']);
export function repairErrorCode(error) {
  return error instanceof Blocked && SAFE_CODES.has(error.code) ? error.code : 'REPAIR_FAILED';
}
export function reportLines(state) {
  const result = ['MAYA_LOGGING_OFF_REPAIR_V1', `patch_attempted=${state?.patchAttempted === true}`,
    `patch_acknowledged=${state?.patchAcknowledged === true}`,
    `off_verified=${state?.offVerified === true}`, `deployment_unchanged=${state?.deploymentUnchanged === true}`,
    `last_request=${['deployments_get','settings_get','settings_patch'].includes(state?.lastRequest) ? state.lastRequest : 'none'}`,
    `last_http_status=${Number.isInteger(state?.httpStatus) && state.httpStatus >= 100 && state.httpStatus <= 599 ? state.httpStatus : 'unknown'}`];
  const keys = Object.keys(projection({})), labels = new Set(['missing','null','object','array','invalid','true','false','empty','nonempty','pass','blocked']);
  for (const prefix of ['before','after']) {
    if (!state?.[prefix]) continue;
    for (const key of prefix === 'before' ? ['observability','global_enabled','logpush','tail_consumers','streaming_tail_consumers'] : keys) {
      const value = state[prefix][key]; result.push(`${prefix}.${key}=${labels.has(value) ? value : 'invalid'}`);
    }
  }
  return result;
}
export async function repairLogging({ env, bytes, source, fetcher = globalThis.fetch, timeoutMs = 30000 }) {
  checkArtifact(bytes); const build = checkBuild(env); checkRepairSource(env, source);
  const base = `https://api.cloudflare.com/client/v4/accounts/${build.accountId}/workers/scripts/${WORKER}`;
  const state = { patchAttempted: false, patchAcknowledged: false, offVerified: false, deploymentUnchanged: false };
  const controller = new AbortController(), cleanup = []; let closed = false, reject;
  const deadline = Date.now() + timeoutMs;
  const check = () => requireThat(!closed && Date.now() < deadline, 'REPAIR_DEADLINE');
  const guard = new Promise((_, fail) => { reject = fail; });
  const timer = setTimeout(() => { closed = true; controller.abort(); reject(new Blocked('REPAIR_DEADLINE')); }, timeoutMs);
  const api = async (path, method = 'GET') => {
    check(); requireThat((method === 'GET' && ['/deployments','/script-settings'].includes(path))
      || (method === 'PATCH' && path === '/script-settings' && !state.patchAttempted), 'REPAIR_WRITE_DENIED');
    if (method === 'PATCH') state.patchAttempted = true;
    state.lastRequest = path === '/deployments' ? 'deployments_get' : method === 'PATCH' ? 'settings_patch' : 'settings_get';
    state.httpStatus = null;
    const response = await fetcher(base + path, { method, redirect: 'error', credentials: 'omit', signal: controller.signal,
      headers: { Authorization: `Bearer ${build.token}`, Accept: 'application/json', ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'PATCH' ? { body: PATCH_BODY } : {}) });
    state.httpStatus = Number.isInteger(response.status) ? response.status : null;
    const cancel = () => response.body?.cancel().catch(() => {});
    cleanup.push(cancel); if (closed || Date.now() >= deadline) { cancel(); check(); }
    requireThat(response.ok && response.headers.get('content-type')?.split(';')[0].trim() === 'application/json' && response.body, 'REPAIR_API_ERROR');
    const reader = response.body.getReader(); cleanup.push(() => reader.cancel().catch(() => {}));
    try {
      let text = '', size = 0; const decoder = new TextDecoder('utf-8', { fatal: true });
      while (true) {
        const { done, value } = await reader.read(); check(); if (done) break;
        size += value.byteLength; requireThat(size <= 65536, 'REPAIR_RESPONSE_TOO_LARGE');
        try { text += decoder.decode(value, { stream: true }); } catch { throw new Blocked('REPAIR_BAD_JSON'); }
      }
      let envelope;
      try { envelope = JSON.parse(text + decoder.decode()); } catch { throw new Blocked('REPAIR_BAD_JSON'); }
      requireThat(envelope?.success === true && object(envelope.result), 'REPAIR_API_ERROR');
      if (method === 'PATCH') state.patchAcknowledged = true;
      check(); return envelope.result;
    } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
  };
  try {
    return await Promise.race([guard, (async () => {
      const beforeDeployment = activeDeployment(await api('/deployments')); check();
      const settings = await api('/script-settings'); check(); state.before = projection(settings);
      const alreadyOff = explicitOff(settings);
      requireThat(alreadyOff || observedNullState(settings), 'REPAIR_UNEXPECTED_SETTINGS');
      requireThat(JSON.stringify(activeDeployment(await api('/deployments'))) === JSON.stringify(beforeDeployment), 'REPAIR_DEPLOYMENT_CHANGED');
      check();
      if (!alreadyOff) await api('/script-settings', 'PATCH');
      check();
      // Read back separately: a successful PATCH alone is not verification.
      const after = await api('/script-settings'); check(); state.after = projection(after);
      state.offVerified = explicitOff(after);
      const afterDeployment = activeDeployment(await api('/deployments')); check();
      state.deploymentUnchanged = JSON.stringify(afterDeployment) === JSON.stringify(beforeDeployment);
      requireThat(state.deploymentUnchanged, 'REPAIR_DEPLOYMENT_CHANGED');
      requireThat(state.offVerified, 'REPAIR_OFF_NOT_VERIFIED');
      return state;
    })()]);
  } catch (error) {
    const failure = new Blocked(repairErrorCode(error)); failure.repairState = structuredClone(state); throw failure;
  } finally {
    closed = true; clearTimeout(timer); controller.abort();
    for (const cancel of cleanup) { try { cancel(); } catch {} }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // Only the direct, approved successor commit may run this temporary repair.
    // cat-file reads raw parent headers even in a shallow Cloudflare checkout.
    checkBuild(process.env);
    const gitOptions = { encoding: 'utf8', timeout: 5000, maxBuffer: 16384 };
    const head = execFileSync('git', ['rev-parse','HEAD'], gitOptions).trim();
    const headers = execFileSync('git', ['cat-file','commit','HEAD'], gitOptions).split('\n\n')[0];
    const parents = headers.split('\n').filter(line => line.startsWith('parent ')).map(line => line.slice(7));
    const bytes = await readFile(new URL('worker-upload.mjs', import.meta.url));
    const state = await repairLogging({ env: process.env, bytes, source: { head, parents } });
    for (const line of reportLines(state)) console.log(line);
    console.log('LOGGING_OFF_VERIFIED_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
  } catch (error) {
    if (error instanceof Blocked && error.repairState) for (const line of reportLines(error.repairState)) console.log(line);
    console.error(repairErrorCode(error));
    console.error('REPAIR_STOPPED_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
    process.exitCode = 1;
  }
}
