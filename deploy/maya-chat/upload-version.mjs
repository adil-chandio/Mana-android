// Build-side uploader. Not imported by the Worker or any browser asset.
// No dependencies, shell interpretation, token output or deployment API.
// Two bounded local Git reads bind this upload to its approved source parent.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loggingOffRepresentation } from './logging-policy.mjs';
import { snapshotAIBinding } from './ai-binding-snapshot.mjs';
import { API_STAGES, summarizeApiFailure } from './api-failure-summary.mjs';
export const BRANCH = 'arena/01a089f7-mana-android';
export const WORKER = 'maya-chat';
export const APPROVED_UPLOAD_PARENT = 'e427b05bf15c07f0facd1ba824422ee308c60ece';
// Owner-supplied public fingerprint. Build-side enrollment guard only, not a secret
// or an application/Worker credential. No environment override or slot creation.
export const APPROVED_APK_KEY_ID = '5FaZUK5cZuVFDEOUvAxqTvNME99OgM0YEPmpxxlpAfQ';
export const SHA256 = '23dab1613dd0bbce327a617c4b29611320726b0a831b8330a8b3f1d45eafa7db';
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HEX32 = /^[a-f0-9]{32}$/i;
const ACKS = ['FREE_PLAN_CONFIRMED', 'MODEL_REVIEW_CONFIRMED', 'LIVE_AUTH_CHECKS_CONFIRMED'];
export class Blocked extends Error {
  constructor(code) { super(code); this.code = code; }
}
const failureDetails = new WeakMap();
export const uploadFailureDetails = error => failureDetails.get(error) ?? null;
const requireThat = (condition, code) => { if (!condition) throw new Blocked(code); };
export function checkArtifact(bytes) {
  requireThat(bytes?.byteLength === 91817 && createHash('sha256').update(bytes).digest('hex') === SHA256, 'ARTIFACT_MISMATCH');
}
export function checkBuild(env) {
  requireThat(env.WORKERS_CI === '1' && env.CI === 'true', 'CLOUDFLARE_BUILD_ONLY');
  requireThat(env.WORKERS_CI_BRANCH === BRANCH, 'WRONG_BRANCH');
  requireThat(env.MAYA_UPLOAD_APPROVED === 'diagnostic-only-v1', 'UPLOAD_APPROVAL_REQUIRED');
  requireThat(/^[a-f0-9]{40}$/i.test(env.WORKERS_CI_COMMIT_SHA || ''), 'COMMIT_ID_REQUIRED');
  requireThat(HEX32.test(env.CLOUDFLARE_ACCOUNT_ID || ''), 'BUILD_ACCOUNT_ID_REQUIRED');
  const token = env.CLOUDFLARE_API_TOKEN;
  requireThat(typeof token === 'string' && token.length >= 20 && token.length <= 4096 && !/\s/.test(token), 'CLOUDFLARE_MANAGED_TOKEN_REQUIRED');
  return { accountId: env.CLOUDFLARE_ACCOUNT_ID, token, commit: env.WORKERS_CI_COMMIT_SHA };
}
export function checkUploadSource(env, source) {
  requireThat(source?.head === env.WORKERS_CI_COMMIT_SHA && source?.head !== APPROVED_UPLOAD_PARENT
    && Array.isArray(source?.parents) && source.parents.length === 1
    && source.parents[0] === APPROVED_UPLOAD_PARENT, 'UPLOAD_SOURCE_NOT_APPROVED');
}
export function readUploadSource(run = execFileSync) {
  // Raw commit headers preserve parents even in shallow Workers Builds clones.
  // Never print raw Git output; a Git error becomes a fixed CLI error code.
  const options = { encoding: 'utf8', timeout: 5000, maxBuffer: 16384, stdio: ['ignore', 'pipe', 'pipe'] };
  const head = run('git', ['rev-parse', 'HEAD'], options).trim();
  const headers = run('git', ['cat-file', 'commit', 'HEAD'], options).split('\n\n')[0];
  return { head, parents: headers.split('\n').filter(line => line.startsWith('parent ')).map(line => line.slice(7)) };
}
export function activeDeployment(result) {
  const first = result?.deployments?.[0];
  requireThat(UUID.test(first?.id || '') && first.strategy === 'percentage' && first.versions?.length === 1
    && first.versions[0].percentage === 100 && UUID.test(first.versions[0].version_id || ''), 'SINGLE_ACTIVE_VERSION_REQUIRED');
  return { id: first.id, version: first.versions[0].version_id };
}
// Unfiltered first page: latest UPLOADED version, not only deployable versions.
export const LATEST_VERSION_PATH = '/versions?page=1&per_page=1';
export function requireLatestActive(result, activeId) {
  requireThat(UUID.test(activeId || '') && Array.isArray(result?.items) && result.items.length === 1
    && UUID.test(result.items[0]?.id || ''), 'LATEST_VERSION_LIST_REQUIRES_REVIEW');
  requireThat(result.items[0].id === activeId, 'LATEST_UPLOADED_NOT_ACTIVE');
}
// Frozen old predicate, used only to keep historical diagnostic reports honest.
export function legacyCheckLogging(settings) {
  // Historical behavior; NOT the current uploader's verification policy.
  requireThat(settings?.observability?.enabled === false && settings.logpush !== true
    && (settings.tail_consumers === undefined || Array.isArray(settings.tail_consumers) && settings.tail_consumers.length === 0), 'LOGGING_MUST_BE_OFF');
}
export function checkLogging(settings) {
  requireThat(loggingOffRepresentation(settings) !== 'blocked', 'LOGGING_MUST_BE_OFF');
}
export async function preserveConfiguration(version, expectedId) {
  requireThat(version?.id === expectedId, 'VERSION_ID_MISMATCH');
  const resources = version.resources, runtime = resources?.script_runtime;
  requireThat(runtime?.compatibility_date === '2026-09-11'
    && (runtime.compatibility_flags === undefined || Array.isArray(runtime.compatibility_flags) && runtime.compatibility_flags.length === 0)
    && !runtime.migration_tag && (!runtime.exports || Object.keys(runtime.exports).length === 0)
    && (!runtime.limits || Object.keys(runtime.limits).length === 0)
    && [undefined, 'standard'].includes(runtime.usage_model), 'UNREVIEWED_RUNTIME_CONFIGURATION');
  const bindings = resources?.bindings;
  requireThat(Array.isArray(bindings) && ((bindings.length === 9 && !bindings.some(b => b?.name === 'APK_PUBLIC_JWK'))
    || (bindings.length === 10 && bindings.some(b => b?.name === 'APK_PUBLIC_JWK'))), 'BINDINGS_REQUIRE_REVIEW');
  const seen = new Map(), preserved = [];
  for (const b of bindings) {
    requireThat(b && typeof b.name === 'string' && !seen.has(b.name), 'DUPLICATE_OR_INVALID_BINDING');
    seen.set(b.name, b);
    if (b.name === 'AI') {
      // Only the observed project field is permitted in this read-side snapshot.
      // Its opaque value is compared, never interpreted or submitted as config.
      requireThat(b.type === 'ai' && Object.keys(b).every(k => ['name', 'type', 'project'].includes(k)), 'EXISTING_AI_BINDING_REQUIRED');
      try { preserved.push(snapshotAIBinding(b)); }
      catch { throw new Blocked('AI_METADATA_REQUIRES_REVIEW'); }
    } else if (b.name === 'DB') {
      const id = b.database_id ?? b.id;
      requireThat(b.type === 'd1' && UUID.test(id || '') && (!b.database_id || !b.id || b.database_id === b.id)
        && Object.keys(b).every(k => ['name', 'type', 'id', 'database_id'].includes(k)), 'EXISTING_DB_REQUIRED');
      preserved.push({ name: 'DB', type: 'd1', database_id: id });
    } else {
      requireThat(['APP_ORIGIN', 'OWNER_PUBLIC_JWK', 'APK_PUBLIC_JWK', 'PAIRING_ENABLED', 'ENABLE_CHAT', ...ACKS].includes(b.name)
        && b.type === 'plain_text' && typeof b.text === 'string'
        && Object.keys(b).every(k => ['name', 'type', 'text'].includes(k)), 'UNREVIEWED_BINDING');
      preserved.push({ name: b.name, type: 'plain_text', text: b.text });
    }
  }
  requireThat(seen.has('DB') && seen.has('AI') && seen.get('PAIRING_ENABLED')?.text === 'true'
    && seen.get('ENABLE_CHAT')?.text === 'false' && ACKS.every(name => ['true', 'false'].includes(seen.get(name)?.text)), 'AI_OFF_PAIRING_ON_REQUIRED');
  const origin = seen.get('APP_ORIGIN')?.text;
  requireThat(typeof origin === 'string' && /^https:\/\/maya-chat\.[a-z0-9-]+\.workers\.dev$/.test(origin), 'FINAL_ORIGIN_REQUIRED');
  async function publicIdentity(text, failure) {
    requireThat(typeof text === 'string' && text.length <= 512, failure);
    try {
      const jwk = JSON.parse(text);
      requireThat(jwk && Object.keys(jwk).sort().join(',') === 'crv,kty,x,y' && jwk.crv === 'P-256' && jwk.kty === 'EC', failure);
      for (const coordinate of [jwk.x, jwk.y]) {
        requireThat(typeof coordinate === 'string' && /^[\w-]{43}$/.test(coordinate)
          && Buffer.from(coordinate, 'base64url').toString('base64url') === coordinate, failure);
      }
      await webcrypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
    } catch { throw new Blocked(failure); }
  }
  const owner = await publicIdentity(seen.get('OWNER_PUBLIC_JWK')?.text, 'PUBLIC_KEY_REQUIRED');
  if (seen.has('APK_PUBLIC_JWK')) {
    requireThat(/^\s*\{\s*"(?:crv|kty|x|y)"\s*:\s*"[A-Za-z0-9_-]+"\s*(?:,\s*"(?:crv|kty|x|y)"\s*:\s*"[A-Za-z0-9_-]+"\s*){3}\}\s*$/.test(seen.get('APK_PUBLIC_JWK')?.text || ''), 'APK_PUBLIC_KEY_REQUIRED');
    const apk = await publicIdentity(seen.get('APK_PUBLIC_JWK')?.text, 'APK_PUBLIC_KEY_REQUIRED');
    requireThat(apk !== owner, 'APK_KEY_MUST_BE_SEPARATE');
  }
  return { main_module: 'worker-upload.mjs', compatibility_date: runtime.compatibility_date,
    compatibility_flags: [], usage_model: 'standard', bindings: preserved.sort((a, b) => a.name.localeCompare(b.name)) };
}
/** This enrollment upload requires the owner's exact already-deployed APK slot. */
export function checkApkEnrollment(configuration) {
  const binding = configuration?.bindings?.find(b => b.name === 'APK_PUBLIC_JWK');
  requireThat(configuration?.bindings?.length === 10 && binding?.type === 'plain_text'
    && typeof binding.text === 'string', 'APK_ENROLLMENT_KEY_REQUIRED');
  try {
    const key = JSON.parse(binding.text);
    requireThat(key && Object.keys(key).sort().join(',') === 'crv,kty,x,y', 'APK_ENROLLMENT_KEY_MISMATCH');
    const canonical = JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y });
    requireThat(createHash('sha256').update(canonical).digest('base64url') === APPROVED_APK_KEY_ID, 'APK_ENROLLMENT_KEY_MISMATCH');
  } catch { throw new Blocked('APK_ENROLLMENT_KEY_MISMATCH'); }
}
// Raw API output stays memory-only; only bounded numeric error codes may be projected.
async function readEnvelope(response, check, cleanup, onFailure) {
  requireThat(response && response.headers.get('content-type')?.split(';')[0].trim() === 'application/json'
    && response.body, 'CLOUDFLARE_API_ERROR');
  const reader = response.body.getReader(); cleanup.push(() => reader.cancel().catch(() => {}));
  let size = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read(); check(); if (done) break;
      size += value.byteLength; requireThat(size <= (response.ok ? 1_048_576 : 65536), 'API_RESPONSE_TOO_LARGE');
      text += decoder.decode(value, { stream: true });
    }
    const parsed = JSON.parse(text + decoder.decode());
    if (!response.ok || parsed?.success !== true || !parsed.result) {
      onFailure(parsed);
      throw new Blocked('CLOUDFLARE_API_ERROR');
    }
    return parsed.result;
  } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function uploadOnly({ env, bytes, source, fetcher = globalThis.fetch, timeoutMs = 60000 }) {
  checkArtifact(bytes); const build = checkBuild(env); checkUploadSource(env, source);
  const base = `https://api.cloudflare.com/client/v4/accounts/${build.accountId}/workers/scripts/${WORKER}`;
  const abort = new AbortController(), cleanup = []; let closed = false, postStarted = false, reject, requestDiagnostic = null;
  const deadline = Date.now() + timeoutMs;
  const guard = new Promise((_, fail) => { reject = fail; });
  const check = () => { requireThat(!closed && Date.now() < deadline, 'UPLOAD_DEADLINE'); };
  const timer = setTimeout(() => { closed = true; abort.abort(); reject(new Blocked('UPLOAD_DEADLINE')); }, timeoutMs);
  const api = async (stage, suffix, body) => {
    check(); requireThat(API_STAGES.includes(stage), 'API_PATH_DENIED');
    // No caller-supplied URL, redirects, cookies, retries, PUT, PATCH or DELETE.
    requireThat(['/deployments', '/script-settings', '/versions?bindings_inherit=strict', LATEST_VERSION_PATH].includes(suffix)
      || /^\/versions\/[a-f0-9-]{36}$/i.test(suffix), 'API_PATH_DENIED');
    if (body) { requireThat(suffix === '/versions?bindings_inherit=strict' && !postStarted, 'WRITE_DENIED'); postStarted = true; }
    requestDiagnostic = summarizeApiFailure(stage);
    const response = await fetcher(base + suffix, { method: body ? 'POST' : 'GET', body,
      headers: { Authorization: `Bearer ${build.token}`, Accept: 'application/json' },
      redirect: 'error', signal: abort.signal });
    const cancel = () => response.body?.cancel().catch(() => {});
    if (closed) { cancel(); check(); }
    cleanup.push(cancel); check();
    requestDiagnostic = summarizeApiFailure(stage, response?.status);
    const result = await readEnvelope(response, check, cleanup, envelope => {
      check(); requestDiagnostic = summarizeApiFailure(stage, response?.status, envelope);
    });
    check(); requestDiagnostic = null; return result;
  };
  try {
    return await Promise.race([guard, (async () => {
      const before = activeDeployment(await api('active_deployment', '/deployments')); check();
      checkLogging(await api('logging_preflight', '/script-settings')); check();
      const configuration = await preserveConfiguration(await api('source_version', `/versions/${before.version}`), before.version); check();
      checkApkEnrollment(configuration); check();
      requireLatestActive(await api('latest_preflight', LATEST_VERSION_PATH), before.version); check();
      requireThat(JSON.stringify(activeDeployment(await api('active_recheck', '/deployments'))) === JSON.stringify(before), 'ACTIVE_VERSION_CHANGED');
      checkLogging(await api('logging_recheck', '/script-settings')); check();
      const metadata = { ...configuration,
        // The API supports latest only. Two latest==active checks gate this request;
        // these reads are NOT an atomic lock. Full metadata readback is still required.
        bindings: configuration.bindings.map(b => b.name === 'AI'
          ? { name: 'AI', type: 'inherit', version_id: 'latest' } : b),
        annotations: {
        'workers/message': 'Maya Qwen separate native APK key v1. Chat OFF. AI inherit requires latest=active checks; readback required. Manual promotion required.',
        'workers/commit_sha': build.commit,
        'workers/repository_url': 'https://github.com/adil-chandio/Mana-android',
        'workers/tag': 'maya-native-key-v1-23dab161'
      } };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('worker-upload.mjs', new Blob([bytes], { type: 'application/javascript+module' }), 'worker-upload.mjs');
      requireLatestActive(await api('latest_recheck', LATEST_VERSION_PATH), before.version); check();
      const uploaded = await api('version_upload', '/versions?bindings_inherit=strict', form); check();
      requireThat(UUID.test(uploaded?.id || ''), 'INVALID_UPLOAD_RECEIPT');
      const observed = await preserveConfiguration(await api('uploaded_version', `/versions/${uploaded.id}`), uploaded.id); check();
      checkApkEnrollment(observed); check();
      requireThat(JSON.stringify(observed.bindings.find(b => b.name === 'AI'))
        === JSON.stringify(configuration.bindings.find(b => b.name === 'AI')), 'INHERITED_AI_METADATA_MISMATCH');
      requireThat(JSON.stringify(observed) === JSON.stringify(configuration), 'UPLOADED_CONFIGURATION_MISMATCH');
      requireThat(JSON.stringify(activeDeployment(await api('active_readback', '/deployments'))) === JSON.stringify(before), 'ACTIVE_VERSION_CHANGED');
      checkLogging(await api('logging_readback', '/script-settings')); check();
      return { worker: WORKER, version: uploaded.id, previousActiveVersion: before.version,
        commit: build.commit, sha256: SHA256, aiEnabled: false, promoted: false,
        aiBindingInherited: true, aiBindingVerified: true, latestMatchedActiveBeforeUpload: true, apkKeyVerified: true };
    })()]);
  } catch (error) {
    // A timed-out/error POST may have created an unpublished version. Never retry.
    const code = error instanceof Blocked ? error.code : 'UPLOAD_FAILED';
    const failure = new Blocked(code + (postStarted ? '_VERSION_MAY_EXIST_NOT_PROMOTED' : '_NO_UPLOAD_STARTED'));
    if (requestDiagnostic) failureDetails.set(failure, requestDiagnostic);
    throw failure;
  } finally {
    closed = true; clearTimeout(timer); abort.abort();
    for (const fn of cleanup) { try { fn(); } catch {} }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const bytes = await readFile(new URL('worker-upload.mjs', import.meta.url));
    checkBuild(process.env);
    const source = readUploadSource();
    const receipt = await uploadOnly({ env: process.env, bytes, source });
    console.log(JSON.stringify(receipt));
    console.log('Uploaded an AI-OFF version only. Active traffic was NOT changed. Review in Cloudflare before any manual promotion.');
  } catch (error) {
    const detail = uploadFailureDetails(error);
    if (detail) {
      console.error('MAYA_UPLOAD_API_FAILURE_V1');
      console.error(`stage=${detail.stage}`);
      console.error(`http_status=${detail.http_status}`);
      console.error(`cf_code_state=${detail.cf_code_state}`);
      console.error(`cf_codes=${detail.cf_codes.length ? detail.cf_codes.join(',') : 'none'}`);
    }
    console.error(error instanceof Blocked ? error.code : 'LOCAL_CHECK_FAILED'); process.exitCode = 1;
  }
}
