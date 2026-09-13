import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Blocked, BRANCH, checkUploadSource } from './upload-version.mjs';
import { APPROVED_DIAGNOSTIC_PARENT, projectBinding, projectExtraFieldName, diagnoseBinding, bindingErrorCode } from './diagnose-binding.mjs';
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
  assert.equal(Object.keys(r).length, 14); for (const state of Object.values(r)) assert(labels.has(state));
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
test('historical diagnostic stays read-only while active command is guarded upload', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url)));
  assert.equal(pkg.scripts.upload, 'npm run check && node upload-version.mjs');
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
  const f = fixture({ name: 'AI', type: 'ai', unreviewedOption: { nested: canary } }); const preload = gitPreload + `const state=${JSON.stringify(f.state)};let n=0;
    globalThis.fetch=async(url,o)=>{n++;if(o.method!=='GET'||o.body||o.redirect!=='error'||o.credentials!=='omit')throw Error('${canary}');
    const suffix=new URL(url).pathname.split('/maya-chat')[1];const result=suffix==='/deployments'?state.deployments:suffix==='/script-settings'?state.settings:suffix==='/versions/${id}'?state.version:null;
    if(!result)throw Error('${canary}');return Response.json({success:true,result});};process.on('exit',()=>{if(n!==5)process.exitCode=9;});`;
  const c = cli(preload); assert.equal(c.status, 0, c.stderr); assert.equal(c.stderr, '');
  const lines = c.stdout.trim().split('\n'); assert.equal(lines.length, 18);
  assert.equal(lines[0], 'MAYA_AI_BINDING_READ_ONLY_V3'); assert.equal(lines.at(-1), 'READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
  assert(lines.includes('extra_field_name=unreviewedOption')); assert(lines.includes('extra_field_name_status=name_only')); assert(lines.includes('unknown_fields=one')); assert(lines.includes('strict_ai_guard=blocked'));
  for (const secret of [canary, id, otherId, ENV.CLOUDFLARE_API_TOKEN, ENV.CLOUDFLARE_ACCOUNT_ID]) assert(!c.stdout.includes(secret));
});
test('CLI local execution and raw Git failure have sanitized output', () => {
  const local = cli('', {}); assert.equal(local.status, 1); assert.equal(local.stdout, ''); assert.equal(local.stderr.trim(), 'CLOUDFLARE_BUILD_ONLY_READ_ONLY_NO_UPLOAD');
  const c = cli(`import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';cp.execFileSync=()=>{throw Error('${canary}')};syncBuiltinESMExports();globalThis.fetch=()=>{throw Error('${canary}')};`);
  assert.equal(c.status, 1); assert.equal(c.stdout, ''); assert.equal(c.stderr.trim(), 'BINDING_DIAGNOSTIC_FAILED_READ_ONLY_NO_UPLOAD');
});

for (const [value, state] of [[undefined, 'missing'], [null, 'null'], [false, 'false'], [true, 'true'],
  ['false', 'other'], [0, 'other'], [{ [canary]: canary }, 'other'], [[canary], 'other']]) {
  test(`raw field emits only fixed category ${state}/${typeof value}, never relaxes strict guard`, async () => {
    const f = fixture({ name: 'AI', type: 'ai', ...(value === undefined ? {} : { raw: value }) });
    const report = await f.run();
    assert.equal(report.raw, state); assert.equal(report.unknown_fields, 'none');
    assert.equal(report.extra_fields, value === undefined ? 'none' : 'one');
    assert.equal(report.strict_ai_guard, value === undefined ? 'pass' : 'blocked');
    assert.equal(f.calls.length, 5); assert(f.calls.every(c => c.options.method === 'GET'));
    assert(!JSON.stringify(report).includes(canary));
  });
}
test('recognized raw field does not hide an additional unknown field or leak its name/value', () => {
  const r = projectBinding([{ name: 'AI', type: 'ai', raw: false, [canary]: canary }]);
  assert.equal(r.raw, 'false'); assert.equal(r.extra_fields, 'multiple');
  assert.equal(r.unknown_fields, 'one'); assert.equal(r.strict_ai_guard, 'blocked');
  assert(!JSON.stringify(r).includes(canary));
});
test('inherited raw is missing and does not influence exact own-key classification', () => {
  const ai = Object.assign(Object.create({ raw: true }), { name: 'AI', type: 'ai' });
  const r = projectBinding([ai]); assert.equal(r.raw, 'missing'); assert.equal(r.extra_fields, 'none'); assert.equal(r.strict_ai_guard, 'pass');
});
test('prior V1 diagnostic source cannot run V2', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: { head: ENV.WORKERS_CI_COMMIT_SHA,
    parents: ['9d4260e1e8de32ab864badb02f5e0c0d843a1392'] } }), /BINDING_DIAGNOSTIC_SOURCE_NOT_APPROVED/);
  assert.equal(f.calls.length, 0);
});

test('name-only projection discloses only one schema key, never its value/nested names', async () => {
  for (const value of [null, false, true, canary, { [canary]: canary }, [canary]]) {
    const ai = { name: 'AI', type: 'ai', unreviewedOption: value };
    const f = fixture(ai), before = structuredClone(f.state), report = await f.run();
    assert.deepEqual(f.state, before); assert.equal(f.calls.length, 5);
    assert.deepEqual(projectExtraFieldName([ai]), { extra_field_name_status: 'name_only', extra_field_name: 'unreviewedOption' });
    assert.equal(report.extra_field_name, 'unreviewedOption'); assert.equal(report.strict_ai_guard, 'blocked');
    assert(!JSON.stringify(report).includes(canary));
  }
});
for (const name of ['bad\nINJECTED', 'bad\rINJECTED', 'bad=INJECTED', 'https://example.invalid', 'name with spaces',
  'x'.repeat(49), '12345678', 'account123', '_proto', 'PRIVATE_CANARY_NEVER_PRINT', 'secret', 'accessToken', 'password',
  'privateKey', 'credential', 'authorization', 'cookie', 'café', '<script>']) {
  test('unsafe extra schema key is withheld without transformed data: ' + JSON.stringify(name), () => {
    const result = projectExtraFieldName([{ name: 'AI', type: 'ai', [name]: canary }]);
    assert.deepEqual(result, { extra_field_name_status: 'withheld', extra_field_name: '-' });
    assert(!JSON.stringify(result).includes(canary));
  });
}
test('normal camel/snake schema names can be observed without accepting configuration', () => {
  for (const name of ['service', 'internalEnv', 'internal_env']) {
    const ai = { name: 'AI', type: 'ai', [name]: canary };
    assert.equal(projectExtraFieldName([ai]).extra_field_name, name);
    assert.equal(projectBinding([ai]).strict_ai_guard, 'blocked');
  }
});
test('zero or known-only extra keys disclose no schema name', () => {
  for (const extra of [{}, { raw: false }, { raw: null, staging: true }]) {
    assert.deepEqual(projectExtraFieldName([{ name: 'AI', type: 'ai', ...extra }]),
      { extra_field_name_status: 'none', extra_field_name: '-' });
  }
});
test('multiple extra keys are ambiguous and never emit names', () => {
  for (const extra of [{ unreviewedOption: canary, otherOption: canary }, { unreviewedOption: canary, raw: false }]) {
    assert.deepEqual(projectExtraFieldName([{ name: 'AI', type: 'ai', ...extra }]),
      { extra_field_name_status: 'ambiguous', extra_field_name: '-' });
  }
});
test('missing duplicate malformed or wrong-type AI emits no extra key', () => {
  for (const bindings of [undefined, null, {}, [], [{ name: 'AI', type: 'other', service: canary }], [{ name: 'AI' }, { name: 'AI' }]]) {
    assert.deepEqual(projectExtraFieldName(bindings), { extra_field_name_status: 'unavailable', extra_field_name: '-' });
  }
});
test('inherited extra key is never disclosed', () => {
  const ai = Object.assign(Object.create({ unreviewedOption: canary }), { name: 'AI', type: 'ai' });
  assert.deepEqual(projectExtraFieldName([ai]), { extra_field_name_status: 'none', extra_field_name: '-' });
});
test('V2 source cannot execute name disclosure diagnostic', async () => {
  const f = fixture(); await assert.rejects(f.run({ source: { head: ENV.WORKERS_CI_COMMIT_SHA,
    parents: ['8474da9e1b4254dfe20c2df4df066a4b2d535025'] } }), /BINDING_DIAGNOSTIC_SOURCE_NOT_APPROVED/);
  assert.equal(f.calls.length, 0);
});
