import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { BRANCH, SHA256, APPROVED_UPLOAD_PARENT, checkUploadSource, readUploadSource, checkArtifact, checkBuild, activeDeployment, checkLogging, preserveConfiguration, uploadOnly, uploadFailureDetails, requireLatestActive, LATEST_VERSION_PATH } from './upload-version.mjs';
import { API_STAGES, summarizeApiFailure } from './api-failure-summary.mjs';
const bytes = readFileSync(new URL('worker-upload.mjs', import.meta.url));
const activeId = '11111111-1111-4111-8111-111111111111', newId = '22222222-2222-4222-8222-222222222222';
const deploymentId = '33333333-3333-4333-8333-333333333333', dbId = '44444444-4444-4444-8444-444444444444';
const SOURCE = { head: 'a'.repeat(40), parents: [APPROVED_UPLOAD_PARENT] };
const ENV = { WORKERS_CI: '1', CI: 'true', WORKERS_CI_BRANCH: BRANCH, WORKERS_CI_COMMIT_SHA: 'a'.repeat(40),
  MAYA_UPLOAD_APPROVED: 'diagnostic-only-v1', CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic-token-for-offline-tests' };
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const full = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
const publicText = JSON.stringify({ crv: full.crv, kty: full.kty, x: full.x, y: full.y });
function fixture() {
  const state = { deployments: { deployments: [{ id: deploymentId, strategy: 'percentage', versions: [{ version_id: activeId, percentage: 100 }] }] },
    latest: { items: [{ id: activeId }] },
    logging: { observability: { enabled: false }, logpush: false, tail_consumers: [] },
    version: { id: activeId, resources: { script_runtime: { compatibility_date: '2026-09-11', compatibility_flags: [], usage_model: 'standard' }, bindings: [
      { name: 'DB', type: 'd1', database_id: dbId }, { name: 'APP_ORIGIN', type: 'plain_text', text: 'https://maya-chat.synthetic-test.workers.dev' },
      { name: 'OWNER_PUBLIC_JWK', type: 'plain_text', text: publicText }, { name: 'PAIRING_ENABLED', type: 'plain_text', text: 'true' },
      { name: 'ENABLE_CHAT', type: 'plain_text', text: 'false' },
      { name: 'AI', type: 'ai', project: { id: 'SYNTHETIC_PROJECT_ONLY', nested: { enabled: false, entries: [null, 'opaque'] } } },
      ...['FREE_PLAN_CONFIRMED', 'MODEL_REVIEW_CONFIRMED', 'LIVE_AUTH_CHECKS_CONFIRMED'].map(name => ({ name, type: 'plain_text', text: 'true' }))
    ] } }, calls: [], metadata: null, hook: null };
  const fetcher = async (url, options) => {
    const suffix = new URL(url).pathname.split('/maya-chat')[1]; state.calls.push({ url, options, suffix });
    if (state.hook) { const r = await state.hook(suffix, options); if (r) return r; }
    let result;
    if (suffix === '/deployments') result = state.deployments;
    else if (suffix === '/script-settings') result = state.logging;
    else if (suffix === '/versions/' + activeId) result = state.version;
    else if (suffix === '/versions' && options.method === 'GET') {
      assert.equal(new URL(url).search, '?page=1&per_page=1'); result = state.latest;
    }
    else if (suffix === '/versions' && options.method === 'POST') {
      assert(options.body instanceof FormData); state.metadata = JSON.parse(await options.body.get('metadata').text());
      assert.deepEqual(Buffer.from(await options.body.get('worker-upload.mjs').arrayBuffer()), bytes);
      assert.equal(options.body.get('worker-upload.mjs').type, 'application/javascript+module'); result = { id: newId }; state.latest = { items: [{ id: newId }] };
    } else if (suffix === '/versions/' + newId) result = { id: newId, resources: {
      bindings: state.metadata.bindings.map(b => {
        if (b.name !== 'AI') return b;
        assert.deepEqual(b, { name: 'AI', type: 'inherit', version_id: 'latest' });
        return state.version.resources.bindings.find(original => original.name === 'AI');
      }), script_runtime: { compatibility_date: state.metadata.compatibility_date, compatibility_flags: [], usage_model: 'standard' }
    } };
    else throw Error('Unexpected fixture route');
    return Response.json({ success: true, result });
  };
  return { state, run: (override = {}) => uploadOnly({ env: { ...ENV }, bytes, source: SOURCE, fetcher, ...override }) };
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
  assert.equal(f.state.calls.length, 11); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
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
test('existing false review acknowledgements are preserved, never enabled', async () => {
  const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'MODEL_REVIEW_CONFIRMED').text = 'false';
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
  assert.equal(f.state.calls.length, 11); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
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

test('Qwen upload source must be the single direct successor of the owner-approved parent', async () => {
  assert.doesNotThrow(() => checkUploadSource(ENV, SOURCE));
  for (const source of [undefined, {}, { ...SOURCE, head: 'c'.repeat(40) }, { ...SOURCE, parents: [] },
    { ...SOURCE, parents: [APPROVED_UPLOAD_PARENT, 'd'.repeat(40)] },
    { ...SOURCE, parents: ['d'.repeat(40)] }, { ...SOURCE, parents: APPROVED_UPLOAD_PARENT }]) {
    const f = fixture(); await assert.rejects(f.run({ source }), /UPLOAD_SOURCE_NOT_APPROVED/);
    assert.equal(f.state.calls.length, 0);
  }
  assert.throws(() => checkUploadSource({ ...ENV, WORKERS_CI_COMMIT_SHA: APPROVED_UPLOAD_PARENT },
    { head: APPROVED_UPLOAD_PARENT, parents: [APPROVED_UPLOAD_PARENT] }), /UPLOAD_SOURCE_NOT_APPROVED/);
});
test('raw Git source reads are bounded, shell-free, and retain shallow-clone parent headers', () => {
  const calls = [];
  const result = readUploadSource((binary, args, options) => {
    calls.push(args.join(' ')); assert.equal(binary, 'git');
    assert.equal(options.timeout, 5000); assert.equal(options.maxBuffer, 16384);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    if (args.join(' ') === 'rev-parse HEAD') return SOURCE.head + '\n';
    assert.equal(args.join(' '), 'cat-file commit HEAD');
    return `tree ${'0'.repeat(40)}\nparent ${APPROVED_UPLOAD_PARENT}\nauthor PRIVATE_CANARY\n\nparent fake-message-parent`;
  });
  assert.deepEqual(result, SOURCE); assert.equal(calls.length, 2);
});
test('Qwen candidate metadata identifies the artifact and pins AI inheritance while preserving other bindings', async () => {
  const f = fixture(); await f.run();
  assert.equal(bytes.byteLength, 83208);
  assert.equal(SHA256, '0c34518aa230f8fdc107a746337d51b2f47dfc0e6d4414e92f0ffdca131d5846');
  assert.equal(f.state.metadata.annotations['workers/tag'], 'maya-null-compat-0c34518a');
  assert.match(f.state.metadata.annotations['workers/message'], /Qwen.*Chat OFF/);
  assert(bytes.includes(Buffer.from('@cf/qwen/qwen3-30b-a3b-fp8')));
  assert.equal(f.state.metadata.bindings.length, f.state.version.resources.bindings.length);
  assert.deepEqual(f.state.metadata.bindings.find(b => b.name === 'AI'), { name: 'AI', type: 'inherit', version_id: 'latest' });
});
test('CLI source gate blocks unrelated future commits before any API request', () => {
  const preload = `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    cp.execFileSync=(binary,args)=>args[0]==='rev-parse'?'${SOURCE.head}\\n':'tree ${'0'.repeat(40)}\\nparent ${'d'.repeat(40)}\\n\\nPRIVATE_CANARY';
    syncBuiltinESMExports();globalThis.fetch=()=>{throw Error('NETWORK_MUST_NOT_RUN')};`;
  const cli = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'upload-version.mjs'],
    { cwd: new URL('.', import.meta.url), env: ENV, encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.equal(cli.stdout, ''); assert.equal(cli.stderr.trim(), 'UPLOAD_SOURCE_NOT_APPROVED');
});
test('CLI Git read failure is sanitized; raw error and credentials never printed', () => {
  const preload = `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    cp.execFileSync=()=>{throw Error('PRIVATE_CANARY')};syncBuiltinESMExports();
    globalThis.fetch=()=>{throw Error('NETWORK_MUST_NOT_RUN')};`;
  const cli = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'upload-version.mjs'],
    { cwd: new URL('.', import.meta.url), env: ENV, encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.equal(cli.stdout, ''); assert.equal(cli.stderr.trim(), 'LOCAL_CHECK_FAILED');
});
test('real CLI Qwen path uses synthetic source/API, makes exactly one version POST, no promotion or PATCH', () => {
  const f = fixture(); f.state.logging = { observability: null, logpush: false, tail_consumers: null };
  const preload = `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    cp.execFileSync=(binary,args)=>{if(binary!=='git')throw Error('wrong binary');
      if(args.join(' ')==='rev-parse HEAD')return '${SOURCE.head}\\n';
      if(args.join(' ')==='cat-file commit HEAD')return 'tree ${'0'.repeat(40)}\\nparent ${APPROVED_UPLOAD_PARENT}\\nauthor PRIVATE_CANARY\\n\\nsubject';
      throw Error('wrong Git request')};syncBuiltinESMExports();let posts=0,calls=0,metadata;
    globalThis.fetch=async(url,opts)=>{calls++;const path=new URL(url).pathname.split('/maya-chat')[1];let result;
      if(opts.method==='POST'){if(path!=='/versions'||++posts!==1)throw Error('unexpected POST');
        metadata=JSON.parse(await opts.body.get('metadata').text());
        if(JSON.stringify(metadata.bindings.find(b=>b.name==='AI'))!==JSON.stringify({name:'AI',type:'inherit',version_id:'latest'}))throw Error('wrong inheritance');
        if(JSON.stringify(metadata).includes('SYNTHETIC_PROJECT_ONLY'))throw Error('opaque metadata submitted');
        result={id:'${newId}'};}
      else{if(opts.method!=='GET')throw Error('mutation forbidden');
        if(path==='/versions'){if(new URL(url).search!=='?page=1&per_page=1')throw Error('wrong list query');result={items:[{id:'${activeId}'}]};}
        else if(path==='/deployments')result=${JSON.stringify(f.state.deployments)};
        else if(path==='/script-settings')result=${JSON.stringify(f.state.logging)};
        else if(path==='/versions/${activeId}')result=${JSON.stringify(f.state.version)};
        else if(path==='/versions/${newId}')result={id:'${newId}',resources:{bindings:metadata.bindings.map(b=>b.name==='AI'?${JSON.stringify(f.state.version.resources.bindings.find(b=>b.name==='AI'))}:b),
          script_runtime:{compatibility_date:'2026-09-11',compatibility_flags:[],usage_model:'standard'}}};
        else throw Error('unexpected endpoint');}
      return Response.json({success:true,result});};
    process.on('exit',()=>{if(posts!==1||calls!==11)process.exitCode=9});`;
  const cli = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'upload-version.mjs'],
    { cwd: new URL('.', import.meta.url), env: ENV, encoding: 'utf8' });
  assert.equal(cli.status, 0); assert.equal(cli.stderr, '');
  const receipt = JSON.parse(cli.stdout.split('\n')[0]);
  assert.equal(receipt.sha256, SHA256); assert.equal(receipt.version, newId);
  assert.equal(receipt.aiEnabled, false); assert.equal(receipt.promoted, false);
  assert.equal(receipt.aiBindingInherited, true); assert.equal(receipt.aiBindingVerified, true);
  assert(!cli.stdout.includes('SYNTHETIC_PROJECT_ONLY')); assert(!cli.stdout.includes('project'));
  assert(!cli.stdout.includes(publicText)); assert(!cli.stdout.includes(ENV.CLOUDFLARE_API_TOKEN)); assert(!cli.stdout.includes('PRIVATE_CANARY'));
  assert.match(cli.stdout, /Active traffic was NOT changed/);
});

test('diagnostic upload preserves all nine current bindings and true review flags while Chat stays OFF', async () => {
  const f = fixture(); f.state.logging = { observability: null, logpush: false, tail_consumers: null };
  const before = structuredClone(f.state.version.resources.bindings);
  const receipt = await f.run();
  assert.equal(receipt.aiEnabled, false); assert.equal(receipt.promoted, false);
  assert.deepEqual(f.state.metadata.bindings, before.map(b => b.name === 'AI' ? { name: 'AI', type: 'inherit', version_id: 'latest' } : b).sort((a, b) => a.name.localeCompare(b.name)));
  assert.equal(f.state.calls.length, 11);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
  assert(f.state.calls.every(c => !c.url.includes('/ai/') && !c.url.includes('/d1/')));
  assert.equal(f.state.deployments.deployments[0].versions[0].version_id, activeId);
});
for (const name of ['AI', 'FREE_PLAN_CONFIRMED', 'MODEL_REVIEW_CONFIRMED', 'LIVE_AUTH_CHECKS_CONFIRMED']) {
  test(`diagnostic requires existing ${name}, never synthesizes a missing binding`, async () => {
    const f = fixture(); f.state.version.resources.bindings = f.state.version.resources.bindings.filter(b => b.name !== name);
    await assert.rejects(f.run(), /BINDINGS_REQUIRE_REVIEW/); assert.equal(f.state.metadata, null);
  });
}
for (const extra of [{ type: 'plain_text', text: 'ai' }, { gateway: { id: 'PRIVATE_GATEWAY' } },
  { staging: true }, { staging: false }, { namespace: 'PRIVATE_NAMESPACE' }, { account_id: 'a'.repeat(32) }]) {
  test(`AI binding does not silently discard or add unreviewed options ${Object.keys(extra).join('/')}`, async () => {
    const f = fixture(); Object.assign(f.state.version.resources.bindings.find(b => b.name === 'AI'), extra);
    await assert.rejects(f.run(), /EXISTING_AI_BINDING_REQUIRED/); assert.equal(f.state.metadata, null);
  });
}
for (const name of ['FREE_PLAN_CONFIRMED', 'MODEL_REVIEW_CONFIRMED', 'LIVE_AUTH_CHECKS_CONFIRMED']) {
  test(`${name} remains an exact validated string acknowledgement, never coerced`, async () => {
    for (const value of [true, false, null, 'TRUE', 'true ', '', 'unknown']) {
      const f = fixture(); f.state.version.resources.bindings.find(b => b.name === name).text = value;
      await assert.rejects(f.run()); assert.equal(f.state.metadata, null);
    }
  });
}
test('Chat ON is still blocked even with the now-approved AI binding and review flags', async () => {
  const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'ENABLE_CHAT').text = 'true';
  await assert.rejects(f.run(), /AI_OFF_PAIRING_ON_REQUIRED/); assert.equal(f.state.metadata, null);
});
test('same-count unknown binding cannot replace a required AI/review binding', async () => {
  for (const name of ['AI', 'MODEL_REVIEW_CONFIRMED']) {
    const f = fixture(); f.state.version.resources.bindings.find(b => b.name === name).name = 'UNKNOWN';
    await assert.rejects(f.run(), /UNREVIEWED_BINDING/); assert.equal(f.state.metadata, null);
  }
});
test('mixed true/false review flags are preserved exactly, with no enable step', async () => {
  const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'FREE_PLAN_CONFIRMED').text = 'false';
  const before = structuredClone(f.state.version.resources.bindings);
  await f.run(); assert.deepEqual(f.state.metadata.bindings, before.map(b => b.name === 'AI' ? { name: 'AI', type: 'inherit', version_id: 'latest' } : b).sort((a, b) => a.name.localeCompare(b.name)));
});
test('post-upload change to a review acknowledgement fails without retry or rollback', async () => {
  const f = fixture(); f.state.hook = suffix => {
    if (suffix === '/versions/' + newId) return Response.json({ success: true, result: { id: newId, resources: {
      ...f.state.version.resources, bindings: f.state.version.resources.bindings.map(b => b.name === 'MODEL_REVIEW_CONFIRMED' ? { ...b, text: 'false' } : b)
    } } });
  };
  await assert.rejects(f.run(), /UPLOADED_CONFIGURATION_MISMATCH_VERSION_MAY_EXIST_NOT_PROMOTED/);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('prior Qwen upload source cannot run the new diagnostic uploader', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: { head: ENV.WORKERS_CI_COMMIT_SHA,
    parents: ['8ef51c86572e770d7d7916724dcb2e8f61802438'] } }), /UPLOAD_SOURCE_NOT_APPROVED/);
  assert.equal(f.state.calls.length, 0);
});

function uploadedVersionWithAI(f, ai) {
  return Response.json({ success: true, result: { id: newId, resources: {
    script_runtime: f.state.version.resources.script_runtime,
    bindings: f.state.metadata.bindings.map(b => b.name === 'AI' ? ai : b)
  } } });
}
test('AI inheritance uses guarded latest; opaque project is absent from multipart and receipt', async () => {
  const f = fixture(), before = structuredClone(f.state.version), receipt = await f.run();
  assert.deepEqual(f.state.version, before);
  assert.deepEqual(f.state.metadata.bindings.find(b => b.name === 'AI'), { name: 'AI', type: 'inherit', version_id: 'latest' });
  assert.equal(receipt.aiBindingInherited, true); assert.equal(receipt.aiBindingVerified, true);
  for (const value of [JSON.stringify(f.state.metadata), JSON.stringify(receipt)]) {
    assert(!value.includes('SYNTHETIC_PROJECT_ONLY')); assert(!value.includes('"project"'));
  }
  assert.equal(f.state.calls.length, 11);
  assert(f.state.calls.every(c => c.options.method === 'GET' || c.url.endsWith('/versions?bindings_inherit=strict')));
});
test('opaque project values are preserved by inheritance, not reconstructed or coerced', async () => {
  for (const value of [null, 'SYNTHETIC_PROJECT_ONLY', 7, false, { nested: ['SYNTHETIC_PROJECT_ONLY', null] }]) {
    const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'AI').project = value;
    const receipt = await f.run(); assert.equal(receipt.aiBindingVerified, true);
    assert.deepEqual(f.state.metadata.bindings.find(b => b.name === 'AI'), { name: 'AI', type: 'inherit', version_id: 'latest' });
  }
});
test('documented name/type-only AI is also inherited, never synthesized', async () => {
  const f = fixture(); delete f.state.version.resources.bindings.find(b => b.name === 'AI').project;
  assert.equal((await f.run()).aiBindingVerified, true);
  assert.equal(f.state.metadata.bindings.find(b => b.name === 'AI').type, 'inherit');
});
test('full AI readback is key-order-independent and preserves nested array order', async () => {
  const f = fixture(); f.state.hook = suffix => {
    if (suffix === '/versions/' + newId) return uploadedVersionWithAI(f, { type: 'ai',
      project: { nested: { entries: [null, 'opaque'], enabled: false }, id: 'SYNTHETIC_PROJECT_ONLY' }, name: 'AI' });
  };
  assert.equal((await f.run()).aiBindingVerified, true);
});
for (const ai of [
  { name: 'AI', type: 'ai' }, { name: 'AI', type: 'ai', project: null },
  { name: 'AI', type: 'ai', project: { id: 'OTHER_PRIVATE_PROJECT' } },
  { name: 'AI', type: 'ai', project: { id: 'SYNTHETIC_PROJECT_ONLY', nested: { enabled: false, entries: ['opaque', null] } } },
  { name: 'AI', type: 'ai', project: { id: 'SYNTHETIC_PROJECT_ONLY', nested: { enabled: 'false', entries: [null, 'opaque'] } } }
]) test('any project removal or nested metadata drift rejects receipt without retry or promotion', async () => {
  const f = fixture(); f.state.hook = suffix => suffix === '/versions/' + newId ? uploadedVersionWithAI(f, ai) : undefined;
  await assert.rejects(f.run(), /^Error: INHERITED_AI_METADATA_MISMATCH_VERSION_MAY_EXIST_NOT_PROMOTED$/);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
  assert.equal(f.state.calls.length, 9); assert.equal(f.state.deployments.deployments[0].versions[0].version_id, activeId);
});
test('null versus missing project is not silently normalized', async () => {
  const f = fixture(); delete f.state.version.resources.bindings.find(b => b.name === 'AI').project;
  f.state.hook = suffix => suffix === '/versions/' + newId ? uploadedVersionWithAI(f, { name: 'AI', type: 'ai', project: null }) : undefined;
  await assert.rejects(f.run(), /INHERITED_AI_METADATA_MISMATCH/);
});
test('unresolved inheritance error never falls back to type ai, UUID or another POST', async () => {
  const f = fixture(); f.state.hook = (suffix, options) => suffix === '/versions' && options.method === 'POST' ? Response.json({ success: false,
    errors: [{ message: 'PRIVATE_PROJECT_VALUE' }] }, { status: 400 }) : undefined;
  await assert.rejects(f.run(), /^Error: CLOUDFLARE_API_ERROR_VERSION_MAY_EXIST_NOT_PROMOTED$/);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1); assert.equal(f.state.calls.length, 8);
});
test('a readback containing unresolved inherit metadata is not accepted as a resolved AI binding', async () => {
  const f = fixture(); f.state.hook = suffix => suffix === '/versions/' + newId
    ? uploadedVersionWithAI(f, { name: 'AI', type: 'inherit', version_id: 'latest' }) : undefined;
  await assert.rejects(f.run(), /EXISTING_AI_BINDING_REQUIRED_VERSION_MAY_EXIST_NOT_PROMOTED/);
});
test('new options on readback remain blocked, despite project being recognized', async () => {
  const f = fixture(); f.state.hook = suffix => suffix === '/versions/' + newId
    ? uploadedVersionWithAI(f, { ...f.state.version.resources.bindings.find(b => b.name === 'AI'), gateway: {} }) : undefined;
  await assert.rejects(f.run(), /EXISTING_AI_BINDING_REQUIRED_VERSION_MAY_EXIST_NOT_PROMOTED/);
});
test('oversized or over-deep project metadata blocks BEFORE upload with no value output', async () => {
  let deep = null; for (let n = 0; n < 9; n++) deep = { nested: deep };
  for (const project of ['x'.repeat(16385), deep]) {
    const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'AI').project = project;
    await assert.rejects(f.run(), /^Error: AI_METADATA_REQUIRES_REVIEW_NO_UPLOAD_STARTED$/);
    assert.equal(f.state.calls.length, 3); assert.equal(f.state.metadata, null);
  }
});
test('preflight configuration is detached from later fixture/provider mutation', async () => {
  const f = fixture(); f.state.hook = (suffix, options) => {
    if (suffix === '/versions' && options.method === 'POST') f.state.version.resources.bindings.find(b => b.name === 'AI').project.nested.enabled = true;
  };
  await assert.rejects(f.run(), /INHERITED_AI_METADATA_MISMATCH/);
});
test('old diagnostic upload parent no longer authorizes inheritance upload', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: { head: ENV.WORKERS_CI_COMMIT_SHA,
    parents: ['96e98a6e764acd324b33365a3a61f98018b82496'] } }), /UPLOAD_SOURCE_NOT_APPROVED/);
  assert.equal(f.state.calls.length, 0);
});

test('safe API summary only includes fixed stage, valid HTTP status and up to three integer codes', () => {
  const report = summarizeApiFailure('version_upload', 400, { success: false,
    errors: [{ code: 10021, message: 'PRIVATE_API_MESSAGE', error_chain: [{ code: 999, message: 'PRIVATE_NESTED' }] },
      { code: 10000, documentation_url: 'https://PRIVATE.invalid' }], result: { token: 'PRIVATE_VALUE' } });
  assert.deepEqual(report, { stage: 'version_upload', http_status: 400, cf_code_state: 'numeric', cf_codes: [10021, 10000] });
  assert(Object.isFrozen(report)); assert(Object.isFrozen(report.cf_codes));
  assert(!JSON.stringify(report).includes('PRIVATE'));
  assert.deepEqual(Object.keys(report), ['stage', 'http_status', 'cf_code_state', 'cf_codes']);
});
for (const errors of [undefined, null, {}, [{ code: '10021' }], [{ code: 'PRIVATE_TOKEN' }], [{ code: -1 }],
  [{ code: 1000000 }], [{ code: 1.5 }], [{ code: true }], [{ code: Infinity }], [{ code: NaN }], [null],
  [{ code: 10021 }, { message: 'PRIVATE' }], Array(4).fill({ code: 10021 })]) {
  test('invalid or excessive API code lists are wholly withheld, not coerced or truncated', () => {
    const r = summarizeApiFailure('version_upload', 400, { success: false, errors });
    assert.equal(r.cf_code_state, 'withheld'); assert.deepEqual(r.cf_codes, []);
  });
}
test('missing versus empty code envelopes remain distinct without raw data', () => {
  assert.equal(summarizeApiFailure('version_upload', 400).cf_code_state, 'unavailable');
  assert.equal(summarizeApiFailure('version_upload', 400, { success: false, errors: [] }).cf_code_state, 'none');
  assert.equal(summarizeApiFailure('version_upload', 200, { success: true, errors: [{ code: 10021 }] }).cf_code_state, 'unavailable');
});
test('unknown stage, fake HTTP statuses and inherited envelope data cannot leak', () => {
  for (const status of ['PRIVATE', '400', 99, 600, 400.5, true, null, undefined]) {
    const r = summarizeApiFailure('PRIVATE_STAGE', status, Object.create({ success: false, errors: [{ code: 10021 }] }));
    assert.deepEqual(r, { stage: 'unavailable', http_status: 'unavailable', cf_code_state: 'unavailable', cf_codes: [] });
  }
  assert.equal(summarizeApiFailure('version_upload', 400, { success: false, errors: [Object.create({ code: 10021 })] }).cf_code_state, 'withheld');
});
for (const [index, stage] of API_STAGES.entries()) test(`API rejection reports exact stage ${stage}, no further calls or retry`, async () => {
  const f = fixture(); f.state.hook = () => f.state.calls.length === index + 1
    ? Response.json({ success: false, errors: [{ code: 10021, message: ENV.CLOUDFLARE_API_TOKEN }] }, { status: 400 }) : undefined;
  let failure;
  await assert.rejects(f.run(), error => { failure = error; return true; });
  assert.deepEqual(uploadFailureDetails(failure), { stage, http_status: 400, cf_code_state: 'numeric', cf_codes: [10021] });
  assert.equal(f.state.calls.length, index + 1);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, index >= 7 ? 1 : 0);
  assert.match(failure.code, index >= 7 ? /VERSION_MAY_EXIST_NOT_PROMOTED$/ : /NO_UPLOAD_STARTED$/);
  assert(!JSON.stringify(uploadFailureDetails(failure)).includes(ENV.CLOUDFLARE_API_TOKEN));
});
test('HTTP 200 with success:false is still an API failure with its numeric code', async () => {
  const f = fixture(); f.state.hook = () => Response.json({ success: false, errors: [{ code: 10000, message: 'PRIVATE' }] });
  await assert.rejects(f.run(), error => {
    assert.deepEqual(uploadFailureDetails(error), { stage: 'active_deployment', http_status: 200, cf_code_state: 'numeric', cf_codes: [10000] });
    return error.code === 'CLOUDFLARE_API_ERROR_NO_UPLOAD_STARTED';
  });
});
test('HTML and malformed JSON failure retain only status/stage, not body or fake codes', async () => {
  for (const response of [new Response('<html>PRIVATE_API_BODY</html>', { status: 403 }),
    new Response('PRIVATE_INVALID_JSON', { status: 400, headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array([255]), { status: 400, headers: { 'content-type': 'application/json' } })]) {
    const f = fixture(); f.state.hook = () => response;
    await assert.rejects(f.run(), error => {
      assert.equal(uploadFailureDetails(error).stage, 'active_deployment');
      assert.equal(uploadFailureDetails(error).http_status, response.status);
      assert.equal(uploadFailureDetails(error).cf_code_state, 'unavailable');
      assert(!error.message.includes('PRIVATE')); return true;
    });
  }
});
test('non-success body has 64 KiB bound and is cancelled, never partially logged', async () => {
  const f = fixture(); let cancelled = 0;
  f.state.hook = () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(65537)); }, cancel() { cancelled++; } }),
    { status: 400, headers: { 'content-type': 'application/json' } });
  await assert.rejects(f.run(), error => {
    assert.equal(uploadFailureDetails(error).http_status, 400); assert.equal(uploadFailureDetails(error).cf_code_state, 'unavailable');
    return error.code === 'API_RESPONSE_TOO_LARGE_NO_UPLOAD_STARTED';
  });
  assert.equal(cancelled, 1);
});
test('network failure has no fabricated HTTP status and no stale prior-request status', async () => {
  const f = fixture(); f.state.hook = () => { if (f.state.calls.length === 2) throw Error('PRIVATE_NETWORK_ERROR'); };
  await assert.rejects(f.run(), error => {
    assert.deepEqual(uploadFailureDetails(error), { stage: 'logging_preflight', http_status: 'unavailable', cf_code_state: 'unavailable', cf_codes: [] });
    return error.code === 'UPLOAD_FAILED_NO_UPLOAD_STARTED';
  });
});
test('deadline detail snapshot is stable when fetch resolves after failure', async () => {
  const f = fixture(); let resolve, failure;
  f.state.hook = () => new Promise(r => { resolve = r; });
  await assert.rejects(f.run({ timeoutMs: 20 }), error => { failure = error; return true; });
  const snapshot = uploadFailureDetails(failure);
  assert.deepEqual(snapshot, { stage: 'active_deployment', http_status: 'unavailable', cf_code_state: 'unavailable', cf_codes: [] });
  resolve(Response.json({ success: false, errors: [{ code: 10021 }] }, { status: 400 }));
  await new Promise(setImmediate); assert.deepEqual(uploadFailureDetails(failure), snapshot); assert.equal(f.state.calls.length, 1);
});
test('post-response configuration guard is not falsely reported as an HTTP failure', async () => {
  const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'ENABLE_CHAT').text = 'true';
  await assert.rejects(f.run(), error => {
    assert.equal(uploadFailureDetails(error), null); return /AI_OFF_PAIRING_ON_REQUIRED/.test(error.code);
  });
});
test('failure details cannot be spoofed by attaching public properties to arbitrary errors', () => {
  for (const error of [null, {}, Error('PRIVATE'), { stage: 'version_upload', http_status: 400, cf_codes: ['PRIVATE'] }]) {
    assert.equal(uploadFailureDetails(error), null);
  }
});
test('previous inheritance-upload source cannot run this new diagnostic attempt', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: { head: ENV.WORKERS_CI_COMMIT_SHA,
    parents: ['fb1796f3f67b65842587ba6be1dc95d6461d6113'] } }), /UPLOAD_SOURCE_NOT_APPROVED/); assert.equal(f.state.calls.length, 0);
});
test('real CLI outputs safe failure block for one rejected synthetic POST, never raw API data', () => {
  const f = fixture();
  const preload = `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    cp.execFileSync=(binary,args)=>{if(binary!=='git')throw Error('PRIVATE');
      if(args.join(' ')==='rev-parse HEAD')return '${SOURCE.head}';
      if(args.join(' ')==='cat-file commit HEAD')return 'tree ${'0'.repeat(40)}\\nparent ${APPROVED_UPLOAD_PARENT}\\nauthor PRIVATE\\n\\nsubject';
      throw Error('PRIVATE')};syncBuiltinESMExports();let calls=0,posts=0;
    globalThis.fetch=async(url,opts)=>{calls++;const path=new URL(url).pathname.split('/maya-chat')[1];let result;
      if(opts.method==='POST'){if(path!=='/versions'||++posts!==1)throw Error('PRIVATE');
        return Response.json({success:false,errors:[{code:10021,message:'PRIVATE_API_TEXT',error_chain:[{message:'PRIVATE_NESTED'}]}]},{status:400});}
      if(opts.method!=='GET')throw Error('PRIVATE');
      if(path==='/versions'){if(new URL(url).search!=='?page=1&per_page=1')throw Error('wrong list query');result={items:[{id:'${activeId}'}]};}
        else if(path==='/deployments')result=${JSON.stringify(f.state.deployments)};
      else if(path==='/script-settings')result=${JSON.stringify(f.state.logging)};
      else if(path==='/versions/${activeId}')result=${JSON.stringify(f.state.version)};
      else throw Error('PRIVATE');return Response.json({success:true,result});};
    process.on('exit',()=>{if(calls!==8||posts!==1)process.exitCode=9});`;
  const cli = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'upload-version.mjs'],
    { cwd: new URL('.', import.meta.url), env: ENV, encoding: 'utf8', timeout: 5000 });
  assert.equal(cli.status, 1); assert.equal(cli.stdout, '');
  assert.deepEqual(cli.stderr.trim().split('\n'), ['MAYA_UPLOAD_API_FAILURE_V1', 'stage=version_upload', 'http_status=400',
    'cf_code_state=numeric', 'cf_codes=10021', 'CLOUDFLARE_API_ERROR_VERSION_MAY_EXIST_NOT_PROMOTED']);
  for (const secret of ['PRIVATE', publicText, ENV.CLOUDFLARE_API_TOKEN, 'SYNTHETIC_PROJECT_ONLY', activeId]) assert(!cli.stderr.includes(secret));
});

test('latest-version guard accepts only one valid first-page item matching active UUID', () => {
  assert.doesNotThrow(() => requireLatestActive({ items: [{ id: activeId, metadata: { private: 'PRIVATE' } }] }, activeId));
  for (const result of [undefined, null, [], {}, { items: null }, { items: [] }, { items: {} }, { items: [null] },
    { items: [{ id: 'latest' }] }, { items: [{ id: '../../PRIVATE' }] }, { items: [{ id: activeId }, { id: newId }] }]) {
    assert.throws(() => requireLatestActive(result, activeId), /^Error: LATEST_VERSION_LIST_REQUIRES_REVIEW$/);
  }
  assert.throws(() => requireLatestActive({ items: [{ id: newId }] }, activeId), /^Error: LATEST_UPLOADED_NOT_ACTIVE$/);
  assert.throws(() => requireLatestActive({ items: [{ id: activeId }] }, 'latest'), /LATEST_VERSION_LIST_REQUIRES_REVIEW/);
});
test('exact request order contains two unfiltered latest checks and only one POST', async () => {
  const f = fixture(), receipt = await f.run();
  assert.deepEqual(f.state.calls.map(c => [c.options.method, c.url.split('/maya-chat')[1]]), [
    ['GET', '/deployments'], ['GET', '/script-settings'], ['GET', '/versions/' + activeId],
    ['GET', LATEST_VERSION_PATH], ['GET', '/deployments'], ['GET', '/script-settings'],
    ['GET', LATEST_VERSION_PATH], ['POST', '/versions?bindings_inherit=strict'],
    ['GET', '/versions/' + newId], ['GET', '/deployments'], ['GET', '/script-settings']
  ]);
  assert.equal(receipt.latestMatchedActiveBeforeUpload, true);
  assert.equal(receipt.aiBindingVerified, true); assert.equal(receipt.promoted, false);
  assert.equal(receipt.previousActiveVersion, activeId);
  assert.deepEqual(f.state.metadata.bindings.find(b => b.name === 'AI'), { name: 'AI', type: 'inherit', version_id: 'latest' });
  assert(!f.state.calls.some(c => c.url.includes('deployable=')));
});
test('an undeployed latest upload blocks BEFORE POST even when active config is valid', async () => {
  const f = fixture(); f.state.latest = { items: [{ id: newId }] };
  await assert.rejects(f.run(), /^Error: LATEST_UPLOADED_NOT_ACTIVE_NO_UPLOAD_STARTED$/);
  assert.equal(f.state.calls.length, 4); assert.equal(f.state.metadata, null);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 0);
  assert.equal(f.state.deployments.deployments[0].versions[0].version_id, activeId);
});
test('new upload between the two latest reads blocks at the second read without POST', async () => {
  const f = fixture(); f.state.hook = () => {
    if (f.state.calls.length === 6) f.state.latest = { items: [{ id: newId }] };
  };
  await assert.rejects(f.run(), /^Error: LATEST_UPLOADED_NOT_ACTIVE_NO_UPLOAD_STARTED$/);
  assert.equal(f.state.calls.length, 7); assert.equal(f.state.metadata, null);
});
for (const at of [4, 7]) test(`malformed latest list at read ${at} blocks with fixed error and no upload`, async () => {
  const f = fixture(); f.state.hook = () => f.state.calls.length === at
    ? Response.json({ success: true, result: { items: [{ id: 'PRIVATE_CANARY' }] } }) : undefined;
  await assert.rejects(f.run(), /^Error: LATEST_VERSION_LIST_REQUIRES_REVIEW_NO_UPLOAD_STARTED$/);
  assert.equal(f.state.calls.length, at); assert.equal(f.state.metadata, null);
});
test('successful first upload leaves latest non-active so a same-source repeat is refused', async () => {
  const f = fixture(); await f.run(); const count = f.state.calls.length;
  await assert.rejects(f.run(), /^Error: LATEST_UPLOADED_NOT_ACTIVE_NO_UPLOAD_STARTED$/);
  assert.equal(f.state.calls.length - count, 4);
  assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('race after last latest read is not claimed impossible: different inherited metadata stops readback', async () => {
  const f = fixture(), original = structuredClone(f.state.version);
  let raceAI;
  f.state.hook = (suffix, options) => {
    if (options.method === 'POST') raceAI = { name: 'AI', type: 'ai', project: 'RACED_PRIVATE_PROJECT' };
    if (suffix === '/versions/' + newId) return uploadedVersionWithAI(f, raceAI);
  };
  await assert.rejects(f.run(), /^Error: INHERITED_AI_METADATA_MISMATCH_VERSION_MAY_EXIST_NOT_PROMOTED$/);
  assert.equal(f.state.calls.length, 9); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
  assert.deepEqual(f.state.version, original); assert.equal(f.state.deployments.deployments[0].versions[0].version_id, activeId);
});
test('guarded latest has no alternative-source fallback after API rejects inheritance', async () => {
  const f = fixture(); f.state.hook = (suffix, options) => options.method === 'POST'
    ? Response.json({ success: false, errors: [{ code: 10057, message: 'PRIVATE' }] }, { status: 400 }) : undefined;
  await assert.rejects(f.run(), error => {
    assert.deepEqual(uploadFailureDetails(error), { stage: 'version_upload', http_status: 400, cf_code_state: 'numeric', cf_codes: [10057] });
    return error.code === 'CLOUDFLARE_API_ERROR_VERSION_MAY_EXIST_NOT_PROMOTED';
  });
  assert.equal(f.state.calls.length, 8); assert.equal(f.state.calls.filter(c => c.options.method === 'POST').length, 1);
});
test('previous UUID diagnostic source is refused before any API read', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: { head: ENV.WORKERS_CI_COMMIT_SHA,
    parents: ['d3426d1b7dd4a689badc22d9ef734de98665c198'] } }), /UPLOAD_SOURCE_NOT_APPROVED/);
  assert.equal(f.state.calls.length, 0);
});
test('hanging second latest read is deadline bounded and cannot later dispatch POST', async () => {
  const f = fixture(); let resolve;
  f.state.hook = () => f.state.calls.length === 7 ? new Promise(r => { resolve = r; }) : undefined;
  await assert.rejects(f.run({ timeoutMs: 150 }), error => {
    assert.equal(uploadFailureDetails(error)?.stage, 'latest_recheck');
    return error.code === 'UPLOAD_DEADLINE_NO_UPLOAD_STARTED';
  });
  resolve(Response.json({ success: true, result: { items: [{ id: activeId }] } }));
  await new Promise(setImmediate); assert.equal(f.state.calls.length, 7); assert.equal(f.state.metadata, null);
});
