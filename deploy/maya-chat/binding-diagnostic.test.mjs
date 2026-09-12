import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Blocked, BRANCH, checkUploadSource } from './upload-version.mjs';
import { APPROVED_DIAGNOSTIC_PARENT, projectBinding, diagnoseBinding, bindingErrorCode } from './diagnose-binding.mjs';
const bytes = readFileSync(new URL('worker-upload.mjs', import.meta.url));
const ENV = { WORKERS_CI: '1', CI: 'true', WORKERS_CI_BRANCH: BRANCH, WORKERS_CI_COMMIT_SHA: 'a'.repeat(40),
  MAYA_UPLOAD_APPROVED: 'diagnostic-only-v1', CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic-read-only-token' };
const source = { head: ENV.WORKERS_CI_COMMIT_SHA, parents: [APPROVED_DIAGNOSTIC_PARENT] };
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const canary = 'PRIVATE_CANARY_NEVER_PRINT';
function fixture(ai = { name: 'AI', type: 'ai', staging: false }) {
  const calls = [], state = { deployments: { deployments: [{ id: otherId, strategy: 'percentage', versions: [{ version_id: id, percentage: 100 }] }] },
    settings: { observability: null, logpush: false, tail_consumers: null },
    version: { id, resources: { bindings: [ai, { name: 'DB', type: 'd1', id: canary },
      ...Object.entries({ ENABLE_CHAT: 'false', PAIRING_ENABLED: 'true', APP_ORIGIN: canary, OWNER_PUBLIC_JWK: canary,
        FREE_PLAN_CONFIRMED: 'true', MODEL_REVIEW_CONFIRMED: 'true', LIVE_AUTH_CHECKS_CONFIRMED: 'true' }).map(([name, text]) => ({ name, type: 'plain_text', text }))] } } };
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (state.hook) { const response = await state.hook(calls.length); if (response) return response; }
    const suffix = new URL(url).pathname.split('/maya-chat')[1];
    const result = suffix === '/deployments' ? state.deployments : suffix === '/script-settings' ? state.settings : suffix === '/versions/' + id ? state.version : null;
    assert(result); return Response.json({ success: true, result });
  };
  return { calls, state, fetcher, run: extra => diagnoseBinding({ env: ENV, bytes, source, fetcher, ...extra }) };
}
test('exactly five bounded GETs, no upload, inference, writes or input mutation', async () => {
  const f = fixture(), before = structuredClone(f.state), r = await f.run();
  assert.deepEqual(f.state, before); assert.equal(r.staging, 'false'); assert.equal(r.strict_ai_guard, 'blocked');
  assert.deepEqual(f.calls.map(c => new URL(c.url).pathname.split('/maya-chat')[1]), ['/deployments', '/script-settings', '/versions/' + id, '/deployments', '/script-settings']);
  for (const { url, options } of f.calls) {
    assert(url.startsWith(`https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/maya-chat/`));
    assert.equal(options.method, 'GET'); assert.equal(options.body, undefined); assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit'); assert.equal(options.headers.Authorization, `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`);
  }
});
test('name/type-only representation passes old predicate but diagnostic STILL never uploads', async () => {
  const f = fixture({ name: 'AI', type: 'ai' }); assert.equal((await f.run()).strict_ai_guard, 'pass'); assert.equal(f.calls.length, 5);
});
test('projection is finite-state only with unknown property names, nested objects and private values', () => {
  const r = projectBinding([{ name: 'AI', type: canary, staging: canary, remote: canary, gateway: { [canary]: canary },
    namespace: canary, account_id: canary, id: canary, text: canary, [canary]: canary }]);
  const labels = new Set(['missing', 'null', 'array', 'string', 'boolean', 'number', 'object', 'invalid', 'none', 'one', 'multiple', 'ai', 'true', 'false', 'other', 'pass', 'blocked']);
  assert.equal(Object.keys(r).length, 13); for (const state of Object.values(r)) assert(labels.has(state));
  assert(!JSON.stringify(r).includes(canary)); assert.equal(r.unknown_fields, 'one'); assert.equal(r.ai_type, 'other');
});
test('projection distinguishes missing/duplicate AI, malformed lists and ignores inherited fields', () => {
  assert.equal(projectBinding([]).ai_matches, 'none'); assert.equal(projectBinding(null).bindings_shape, 'null');
  assert.equal(projectBinding([{ name: 'AI' }, { name: 'AI' }]).ai_matches, 'multiple');
  assert.equal(projectBinding([Object.create({ name: 'AI', type: 'ai' })]).ai_matches, 'none');
  assert.equal(projectBinding([{ name: 'AI', type: null }]).ai_type, 'null');
});
for (const [value, state] of [[undefined, 'missing'], [null, 'null'], [true, 'true'], [false, 'false'], ['false', 'other'], [{}, 'other']]) {
  test(`staging and remote safe category ${state}/${typeof value}`, () => {
    const r = projectBinding([{ name: 'AI', type: 'ai', staging: value, remote: value }]);
    assert.equal(r.staging, state); assert.equal(r.remote, state);
  });
}
for (const key of Object.keys(ENV)) test(`missing ${key} prevents all requests`, async () => {
  const f = fixture(); await assert.rejects(f.run({ env: { ...ENV, [key]: undefined } })); assert.equal(f.calls.length, 0);
});
test('artifact mismatch prevents all requests', async () => {
  const f = fixture(); await assert.rejects(f.run({ bytes: Buffer.from('changed') }), /ARTIFACT_MISMATCH/); assert.equal(f.calls.length, 0);
});
for (const wrong of [undefined, { ...source, head: 'c'.repeat(40) }, { ...source, parents: [] },
  { ...source, parents: ['d'.repeat(40)] }, { ...source, parents: [APPROVED_DIAGNOSTIC_PARENT, 'd'.repeat(40)] },
  { head: APPROVED_DIAGNOSTIC_PARENT, parents: [APPROVED_DIAGNOSTIC_PARENT] }]) test('unapproved source blocks all requests', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: wrong }), /BINDING_DIAGNOSTIC_SOURCE_NOT_APPROVED/); assert.equal(f.calls.length, 0);
});
test('diagnostic source cannot invoke historical uploader', () => {
  assert.throws(() => checkUploadSource(ENV, source), /UPLOAD_SOURCE_NOT_APPROVED/);
});
for (const text of ['true', true, null, 'FALSE']) test(`nonliteral Chat OFF blocks report (${text})`, async () => {
  const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'ENABLE_CHAT').text = text;
  await assert.rejects(f.run(), /DIAGNOSTIC_CHAT_OFF_PAIRING_ON_REQUIRED/); assert.equal(f.calls.length, 3);
});
test('pairing OFF blocks report', async () => {
  const f = fixture(); f.state.version.resources.bindings.find(b => b.name === 'PAIRING_ENABLED').text = 'false';
  await assert.rejects(f.run(), /DIAGNOSTIC_CHAT_OFF_PAIRING_ON_REQUIRED/);
});
test('wrong version id and malformed bindings block report', async () => {
  for (const change of [f => f.state.version.id = otherId, f => f.state.version.resources.bindings.pop(),
    f => f.state.version.resources.bindings[0] = null, f => f.state.version.resources.bindings[0].name = 'DB']) {
    const f = fixture(); change(f); await assert.rejects(f.run(), /DIAGNOSTIC_(VERSION_MISMATCH|BINDINGS_REQUIRE_REVIEW)/); assert.equal(f.calls.length, 3);
  }
});
test('active deployment drift prevents report without retry', async () => {
  const f = fixture(); f.state.hook = n => { if (n === 4) f.state.deployments.deployments[0].versions[0].version_id = otherId; };
  await assert.rejects(f.run(), /DIAGNOSTIC_ACTIVE_VERSION_CHANGED/); assert.equal(f.calls.length, 4);
});
for (const at of [2, 5]) test(`logging ON at read ${at} blocks report`, async () => {
  const f = fixture(); f.state.hook = n => { if (n === at) f.state.settings.observability = { enabled: true }; };
  await assert.rejects(f.run(), /LOGGING_MUST_BE_OFF/); assert.equal(f.calls.length, at);
});
test('HTTP, content type, envelope errors have fixed codes and no retries', async () => {
  for (const response of [new Response(canary, { status: 401 }), new Response(canary, { status: 302 }),
    new Response(canary), Response.json({ success: false, errors: [canary] }), Response.json({ success: true, result: [] })]) {
    let n = 0; await assert.rejects(diagnoseBinding({ env: ENV, bytes, source, fetcher: async () => { n++; return response; } }), /DIAGNOSTIC_API_ERROR/); assert.equal(n, 1);
  }
});
test('malformed JSON and UTF-8 sanitized', async () => {
  for (const body of [canary, new Uint8Array([255])]) {
    const f = fixture(); await assert.rejects(f.run({ fetcher: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), /DIAGNOSTIC_BAD_JSON/);
  }
});
test('response byte bound cancels stream', async () => {
  let cancelled = 0;
  const f = fixture(); await assert.rejects(f.run({ fetcher: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1_048_577)); }, cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } }) }), /DIAGNOSTIC_RESPONSE_TOO_LARGE/);
  assert.equal(cancelled, 1);
});
test('hanging fetch deadline and late body cancellation prevent later reads', async () => {
  let resolve, cancelled = 0, n = 0;
  const f = fixture(); const p = f.run({ timeoutMs: 20, fetcher: () => { n++; return new Promise(r => { resolve = r; }); } });
  await assert.rejects(p, /DIAGNOSTIC_DEADLINE/);
  resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise(setImmediate); assert.equal(n, 1); assert.equal(cancelled, 1);
});
test('hanging reader is deadline-bounded and cancelled', async () => {
  let cancelled = 0;
  const f = fixture(); await assert.rejects(f.run({ timeoutMs: 20, fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } }) }), /DIAGNOSTIC_DEADLINE/);
  assert.equal(cancelled, 1);
});
test('elapsed wall deadline blocks even before timer callback', async () => {
  let cancelled = 0;
  const f = fixture(); await assert.rejects(f.run({ timeoutMs: 5, fetcher: async () => {
    const until = Date.now() + 20; while (Date.now() < until) {}
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } });
  } }), /DIAGNOSTIC_DEADLINE/); assert.equal(cancelled, 1);
});
test('arbitrary thrown errors and spoofed codes cannot leak', async () => {
  for (const error of [Error(canary), new Blocked(canary), { code: canary }, canary]) {
    assert.equal(bindingErrorCode(error), 'BINDING_DIAGNOSTIC_FAILED');
    await assert.rejects(fixture().run({ fetcher: async () => { throw error; } }), /^Error: BINDING_DIAGNOSTIC_FAILED$/);
  }
});
test('package upload command ONLY runs read-only entrypoint after tests', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url)));
  assert.equal(pkg.scripts.upload, 'npm run check && node diagnose-binding.mjs');
  assert(pkg.scripts.test.includes('binding-diagnostic.test.mjs')); assert.equal(pkg.dependencies, undefined);
  const src = readFileSync(new URL('diagnose-binding.mjs', import.meta.url), 'utf8');
  assert(!src.includes('uploadOnly')); assert(!/method: '(POST|PATCH|PUT|DELETE)'/.test(src));
});
function cli(preload, env = ENV) {
  return spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'diagnose-binding.mjs'],
    { cwd: new URL('.', import.meta.url), env, encoding: 'utf8', timeout: 5000 });
}
const gitPreload = `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
  cp.execFileSync=(cmd,args)=>{if(cmd!=='git')throw Error('${canary}');if(args.join(' ')==='rev-parse HEAD')return '${source.head}';
  if(args.join(' ')==='cat-file commit HEAD')return 'tree ${'0'.repeat(40)}\\nparent ${APPROVED_DIAGNOSTIC_PARENT}\\nauthor ${canary}\\n\\nsubject';throw Error('${canary}');};syncBuiltinESMExports();`;
test('real CLI with synthetic source/API outputs only fixed labels and no identifiers/secrets', () => {
  const f = fixture(); const preload = gitPreload + `const state=${JSON.stringify(f.state)};let n=0;
    globalThis.fetch=async(url,o)=>{n++;if(o.method!=='GET'||o.body||o.redirect!=='error'||o.credentials!=='omit')throw Error('${canary}');
    const suffix=new URL(url).pathname.split('/maya-chat')[1];const result=suffix==='/deployments'?state.deployments:suffix==='/script-settings'?state.settings:suffix==='/versions/${id}'?state.version:null;
    if(!result)throw Error('${canary}');return Response.json({success:true,result});};process.on('exit',()=>{if(n!==5)process.exitCode=9;});`;
  const c = cli(preload); assert.equal(c.status, 0, c.stderr); assert.equal(c.stderr, '');
  const lines = c.stdout.trim().split('\n'); assert.equal(lines.length, 15);
  assert.equal(lines[0], 'MAYA_AI_BINDING_READ_ONLY_V1'); assert.equal(lines.at(-1), 'READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
  assert(lines.includes('staging=false')); assert(lines.includes('strict_ai_guard=blocked'));
  for (const secret of [canary, id, otherId, ENV.CLOUDFLARE_API_TOKEN, ENV.CLOUDFLARE_ACCOUNT_ID]) assert(!c.stdout.includes(secret));
});
test('CLI local execution and raw Git failure have sanitized output', () => {
  const local = cli('', {}); assert.equal(local.status, 1); assert.equal(local.stdout, ''); assert.equal(local.stderr.trim(), 'CLOUDFLARE_BUILD_ONLY_READ_ONLY_NO_UPLOAD');
  const c = cli(`import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';cp.execFileSync=()=>{throw Error('${canary}')};syncBuiltinESMExports();globalThis.fetch=()=>{throw Error('${canary}')};`);
  assert.equal(c.status, 1); assert.equal(c.stdout, ''); assert.equal(c.stderr.trim(), 'BINDING_DIAGNOSTIC_FAILED_READ_ONLY_NO_UPLOAD');
});
