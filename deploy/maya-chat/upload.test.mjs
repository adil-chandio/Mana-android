import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { BRANCH, SHA256, checkArtifact, checkBuild, activeDeployment, checkLogging, preserveConfiguration, uploadOnly } from './upload-version.mjs';
const bytes = readFileSync(new URL('worker-upload.mjs', import.meta.url));
const activeId = '11111111-1111-4111-8111-111111111111', newId = '22222222-2222-4222-8222-222222222222';
const deploymentId = '33333333-3333-4333-8333-333333333333', dbId = '44444444-4444-4444-8444-444444444444';
const ENV = { WORKERS_CI: '1', CI: 'true', WORKERS_CI_BRANCH: BRANCH, WORKERS_CI_COMMIT_SHA: 'a'.repeat(40),
  MAYA_UPLOAD_APPROVED: 'diagnostic-only-v1', CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic-token-for-offline-tests' };
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const full = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
const publicText = JSON.stringify({ crv: full.crv, kty: full.kty, x: full.x, y: full.y });
function fixture() {
  const state = { deployments: { deployments: [{ id: deploymentId, strategy: 'percentage', versions: [{ version_id: activeId, percentage: 100 }] }] },
    logging: { observability: { enabled: false }, logpush: false, tail_consumers: [] },
    version: { id: activeId, resources: { script_runtime: { compatibility_date: '2026-09-11', compatibility_flags: [], usage_model: 'standard' }, bindings: [
      { name: 'DB', type: 'd1', database_id: dbId }, { name: 'APP_ORIGIN', type: 'plain_text', text: 'https://maya-chat.synthetic-test.workers.dev' },
      { name: 'OWNER_PUBLIC_JWK', type: 'plain_text', text: publicText }, { name: 'PAIRING_ENABLED', type: 'plain_text', text: 'true' },
      { name: 'ENABLE_CHAT', type: 'plain_text', text: 'false' }
    ] } }, calls: [], metadata: null, hook: null };
  const fetcher = async (url, options) => {
    const suffix = new URL(url).pathname.split('/maya-chat')[1]; state.calls.push({ url, options, suffix });
    if (state.hook) { const r = await state.hook(suffix, options); if (r) return r; }
    let result;
    if (suffix === '/deployments') result = state.deployments;
    else if (suffix === '/script-settings') result = state.logging;
    else if (suffix === '/versions/' + activeId) result = state.version;
    else if (suffix === '/versions' && options.method === 'POST') {
      assert(options.body instanceof FormData); state.metadata = JSON.parse(await options.body.get('metadata').text());
      assert.deepEqual(Buffer.from(await options.body.get('worker-upload.mjs').arrayBuffer()), bytes);
      assert.equal(options.body.get('worker-upload.mjs').type, 'application/javascript+module'); result = { id: newId };
    } else if (suffix === '/versions/' + newId) result = { id: newId, resources: {
      bindings: state.metadata.bindings, script_runtime: { compatibility_date: state.metadata.compatibility_date, compatibility_flags: [], usage_model: 'standard' }
    } };
    else throw Error('Unexpected fixture route');
    return Response.json({ success: true, result });
  };
  return { state, run: (override = {}) => uploadOnly({ env: { ...ENV }, bytes, fetcher, ...override }) };
}
test('artifact is exact approved byte sequence with no substitution', () => {
  checkArtifact(bytes); assert(readFileSync(new URL('ARTIFACT.sha256', import.meta.url), 'utf8').startsWith(SHA256));
  const changed = Buffer.from(bytes); changed[500] ^= 1; assert.throws(() => checkArtifact(changed), /ARTIFACT_MISMATCH/);
  assert.throws(() => checkArtifact(bytes.subarray(1)), /ARTIFACT_MISMATCH/);
});
test('only Workers Builds, exact session branch and explicit upload acknowledgement can proceed', async () => {
  for (const [name, value] of [['WORKERS_CI', undefined], ['CI', 'false'], ['WORKERS_CI_BRANCH', 'main'], ['WORKERS_CI_BRANCH', 'pull-request'],
    ['MAYA_UPLOAD_APPROVED', 'true'], ['WORKERS_CI_COMMIT_SHA', '../x'], ['CLOUDFLARE_ACCOUNT_ID', '../other'], ['CLOUDFLARE_API_TOKEN', 'short']]) {
    const f = fixture(); await assert.rejects(f.run({ env: { ...ENV, [name]: value } })); assert.equal(f.state.calls.length, 0);
  }
  assert.equal(checkBuild(ENV).accountId, ENV.CLOUDFLARE_ACCOUNT_ID);
});
test('successful upload makes exactly one POST to versions, no deployment/settings/DB mutation', async () => {
  const f = fixture(), receipt = await f.run();
  assert.equal(receipt.promoted, false); assert.equal(receipt.aiEnabled, false); assert.equal(receipt.version, newId); assert.equal(receipt.previousActiveVersion, activeId);
  assert.equal(f.state.calls.length, 9); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
  for (const c of f.state.calls) {
    assert.equal(new URL(c.url).origin, 'https://api.cloudflare.com'); assert(c.url.includes('/workers/scripts/maya-chat/'));
    assert.equal(c.options.redirect, 'error'); assert.equal(c.options.headers.Authorization, 'Bearer ' + ENV.CLOUDFLARE_API_TOKEN);
    if (c.options.method !== 'GET') assert.equal(c.url.split('/maya-chat')[1], '/versions?bindings_inherit=strict');
  }
  assert.equal(f.state.metadata.bindings.find(b => b.name === 'DB').database_id, dbId);
  assert.equal(f.state.metadata.bindings.find(b => b.name === 'OWNER_PUBLIC_JWK').text, publicText);
  assert.equal(f.state.metadata.bindings.find(b => b.name === 'ENABLE_CHAT').text, 'false');
  assert.equal(f.state.metadata.annotations['workers/commit_sha'], ENV.WORKERS_CI_COMMIT_SHA);
  assert(!JSON.stringify(receipt).includes(publicText)); assert(!JSON.stringify(receipt).includes(ENV.CLOUDFLARE_API_TOKEN));
  assert.equal(f.state.deployments.deployments[0].versions[0].version_id, activeId);
});
test('preserves deprecated and current D1 IDs, rejects contradictory aliases', async () => {
  const f = fixture(), db = f.state.version.resources.bindings[0]; db.id = db.database_id; delete db.database_id;
  assert.equal((await f.run()).promoted, false);
  const bad = fixture(); bad.state.version.resources.bindings[0].id = newId; await assert.rejects(bad.run(), /EXISTING_DB_REQUIRED/);
});
test('first deployment is active; mixed/empty/malformed traffic split is refused', () => {
  const f = fixture(); assert.equal(activeDeployment(f.state.deployments).version, activeId);
  for (const versions of [[], [{ version_id: activeId, percentage: 50 }], [{ version_id: activeId, percentage: 50 }, { version_id: newId, percentage: 50 }]]) {
    f.state.deployments.deployments[0].versions = versions; assert.throws(() => activeDeployment(f.state.deployments), /SINGLE_ACTIVE_VERSION_REQUIRED/);
  }
  assert.throws(() => activeDeployment({ deployments: [] }));
});
for (const modification of ['missing', 'enabled', 'logpush', 'tail', 'malformed-tail']) test(`logging ${modification} is refused`, async () => {
  const f = fixture();
  if (modification === 'missing') delete f.state.logging.observability;
  if (modification === 'enabled') f.state.logging.observability.enabled = true;
  if (modification === 'logpush') f.state.logging.logpush = true;
  if (modification === 'tail') f.state.logging.tail_consumers = [{ service: 'other' }];
  if (modification === 'malformed-tail') f.state.logging.tail_consumers = {};
  await assert.rejects(f.run(), /LOGGING_MUST_BE_OFF/); assert.equal(f.state.metadata, null);
});
for (const name of ['DB', 'APP_ORIGIN', 'OWNER_PUBLIC_JWK', 'PAIRING_ENABLED', 'ENABLE_CHAT']) test(`missing ${name} cannot silently drop a binding`, async () => {
  const f = fixture(); f.state.version.resources.bindings = f.state.version.resources.bindings.filter(b => b.name !== name);
  await assert.rejects(f.run()); assert.equal(f.state.metadata, null);
});
for (const extra of [{ name: 'AI', type: 'ai' }, { name: 'secret', type: 'secret_text' }, { name: 'EXTRA', type: 'plain_text', text: 'x' },
  { name: 'DB', type: 'd1', database_id: dbId }, { name: 'MODEL_REVIEW_CONFIRMED', type: 'plain_text', text: 'true' }]) {
  test(`unreviewed/duplicate binding ${extra.name}/${extra.type} never uploads`, async () => {
    const f = fixture(); f.state.version.resources.bindings.push(extra); await assert.rejects(f.run()); assert.equal(f.state.metadata, null);
  });
}
test('optional false review acknowledgements are preserved, never enabled', async () => {
  const f = fixture(); f.state.version.resources.bindings.push({ name: 'MODEL_REVIEW_CONFIRMED', type: 'plain_text', text: 'false' });
  await f.run(); assert.equal(f.state.metadata.bindings.find(b => b.name === 'MODEL_REVIEW_CONFIRMED').text, 'false');
});
for (const [name, value] of [['PAIRING_ENABLED', 'false'], ['ENABLE_CHAT', 'true'], ['ENABLE_CHAT', false],
  ['APP_ORIGIN', 'http://maya-chat.synthetic-test.workers.dev'], ['APP_ORIGIN', 'https://other.synthetic-test.workers.dev'],
  ['APP_ORIGIN', 'https://maya-chat.synthetic-test.workers.dev/'], ['OWNER_PUBLIC_JWK', '{}'], ['OWNER_PUBLIC_JWK', 'x'.repeat(513)]]) {
  test(`invalid ${name} value blocks before upload`, async () => {
    const f = fixture(); f.state.version.resources.bindings.find(b => b.name === name).text = value;
    await assert.rejects(f.run()); assert.equal(f.state.metadata, null);
  });
}
test('private or noncanonical public keys never reach multipart upload', async () => {
  for (const jwk of [{ ...JSON.parse(publicText), d: 'private' }, { ...JSON.parse(publicText), x: 'x' }, { ...JSON.parse(publicText), y: 'A'.repeat(43) }]) {
    const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'OWNER_PUBLIC_JWK').text = JSON.stringify(jwk);
    await assert.rejects(f.run(), /PUBLIC_KEY_REQUIRED/); assert.equal(f.state.metadata, null);
  }
});
for (const [name, value] of [['compatibility_date', '2025-01-01'], ['compatibility_flags', ['nodejs_compat']], ['usage_model', 'unbound'],
  ['limits', { cpu_ms: 100 }], ['exports', { extra: { type: 'durable_object' } }], ['migration_tag', 'v1']]) {
  test(`unreviewed runtime ${name} is refused`, async () => {
    const f = fixture(); f.state.version.resources.script_runtime[name] = value; await assert.rejects(f.run(), /UNREVIEWED_RUNTIME_CONFIGURATION/);
    assert.equal(f.state.metadata, null);
  });
}
test('changed deployment or logging during preflight blocks POST', async () => {
  for (const stage of ['deployment', 'logging']) {
    const f = fixture(); let n = 0;
    f.state.hook = (suffix) => {
      if (suffix === '/versions/' + activeId) {
        if (stage === 'deployment') f.state.deployments.deployments[0].id = newId;
        else f.state.logging.observability.enabled = true;
      }
    };
    await assert.rejects(f.run(), stage === 'deployment' ? /ACTIVE_VERSION_CHANGED/ : /LOGGING_MUST_BE_OFF/);
    assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, n);
  }
});
test('mismatch after POST fails without retry, rollback, deletion or promotion', async () => {
  const f = fixture(); f.state.hook = suffix => {
    if (suffix === '/versions/' + newId) return Response.json({ success: true, result: { id: newId, resources: {
      ...f.state.version.resources, bindings: f.state.version.resources.bindings.map(b => b.name === 'APP_ORIGIN' ? { ...b, text: 'https://maya-chat.changed.workers.dev' } : b)
    } } });
  };
  await assert.rejects(f.run(), /UPLOADED_CONFIGURATION_MISMATCH_VERSION_MAY_EXIST_NOT_PROMOTED/);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('post-upload deployment drift is reported, never undone', async () => {
  const f = fixture(); f.state.hook = suffix => { if (suffix === '/versions/' + newId) f.state.deployments.deployments[0].id = newId; };
  await assert.rejects(f.run(), /ACTIVE_VERSION_CHANGED_VERSION_MAY_EXIST_NOT_PROMOTED/);
  assert(f.state.calls.every(c => ['GET', 'POST'].includes(c.options.method))); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('HTTP/auth/redirect/JSON errors are generic; no raw API body, token or retries', async () => {
  for (const status of [302, 401, 403, 429, 500]) {
    const f = fixture(); f.state.hook = () => new Response('sensitive raw body ' + ENV.CLOUDFLARE_API_TOKEN, { status });
    await assert.rejects(f.run(), error => !error.message.includes(ENV.CLOUDFLARE_API_TOKEN) && error.code === 'CLOUDFLARE_API_ERROR_NO_UPLOAD_STARTED');
    assert.equal(f.state.calls.length, 1);
  }
});
test('failed POST is uncertain; no automatic duplicate version upload', async () => {
  const f = fixture(); f.state.hook = (suffix, opts) => { if (opts.method === 'POST') throw Error('private API exception'); };
  await assert.rejects(f.run(), /UPLOAD_FAILED_VERSION_MAY_EXIST_NOT_PROMOTED/); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('deadline covers hanging fetch, prevents late uploads and cancels late responses', async () => {
  const f = fixture(); let resolve, cancelled = 0;
  f.state.hook = () => new Promise(r => { resolve = r; });
  await assert.rejects(f.run({ timeoutMs: 20 }), /UPLOAD_DEADLINE_NO_UPLOAD_STARTED/);
  resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise(setImmediate); assert.equal(cancelled, 1); assert.equal(f.state.calls.length, 1);
});
test('streamed API response is byte-bounded and cancelled', async () => {
  const f = fixture(); let cancelled = 0;
  f.state.hook = () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1048577)); }, cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(f.run(), /API_RESPONSE_TOO_LARGE_NO_UPLOAD_STARTED/); assert.equal(cancelled, 1);
});
test('CLI cannot upload in local shell and logs only a generic gate code', () => {
  const cli = spawnSync(process.execPath, ['upload-version.mjs'], { cwd: new URL('.', import.meta.url), env: {}, encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.equal(cli.stdout, ''); assert.equal(cli.stderr.trim(), 'CLOUDFLARE_BUILD_ONLY');
});
test('default Wrangler is intentionally nondeployable; package has no dependencies or lifecycle install hooks', () => {
  const config = readFileSync(new URL('wrangler.jsonc', import.meta.url), 'utf8');
  assert(config.includes('DIRECT_WRANGLER_DEPLOY_IS_DISABLED.mjs')); assert(!existsSync(new URL('DIRECT_WRANGLER_DEPLOY_IS_DISABLED.mjs', import.meta.url)));
  const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url))); assert.equal(pkg.dependencies, undefined);
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ['check', 'test', 'upload']); assert(pkg.scripts.upload.startsWith('npm run check &&'));
});
test('real observed null logging shape permits one version upload, no settings PATCH or deployment mutation', async () => {
  const f = fixture(); f.state.logging = { observability: null, logpush: false, tail_consumers: null };
  const result = await f.run(); assert.equal(result.promoted, false); assert.equal(result.aiEnabled, false);
  assert.equal(f.state.calls.length, 9); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
  assert(f.state.calls.every(c => c.options.method === 'GET' || c.options.method === 'POST' && c.suffix === '/versions'));
  assert.equal(f.state.metadata.bindings.find(b => b.name === 'DB').database_id, dbId);
  assert.equal(f.state.metadata.bindings.find(b => b.name === 'OWNER_PUBLIC_JWK').text, publicText);
});
test('logging enabled after a canonical-null preflight still blocks before upload', async () => {
  const f = fixture(); f.state.logging = { observability: null, logpush: false, tail_consumers: null };
  f.state.hook = suffix => { if (suffix === '/versions/' + activeId) f.state.logging.observability = { enabled: true }; };
  await assert.rejects(f.run(), /LOGGING_MUST_BE_OFF_NO_UPLOAD_STARTED/); assert.equal(f.state.metadata, null);
});
test('enabled child channel or streaming consumer blocks before upload even under global OFF', async () => {
  for (const extra of [{ observability: { enabled: false, logs: { enabled: true } } },
    { observability: { enabled: false, traces: { enabled: true } } }, { streaming_tail_consumers: [{ service: 'private' }] }]) {
    const f = fixture(); Object.assign(f.state.logging, extra);
    await assert.rejects(f.run(), /LOGGING_MUST_BE_OFF_NO_UPLOAD_STARTED/); assert.equal(f.state.metadata, null);
  }
});
