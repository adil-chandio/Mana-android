import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { BRANCH, Blocked } from './upload-version.mjs';
import { APPROVED_PARENT, checkRepairSource, explicitOff, reportLines, repairLogging, repairErrorCode } from './repair-logging.mjs';
const bytes = readFileSync(new URL('worker-upload.mjs', import.meta.url));
const ENV = { WORKERS_CI: '1', CI: 'true', WORKERS_CI_BRANCH: BRANCH, WORKERS_CI_COMMIT_SHA: 'a'.repeat(40),
  MAYA_UPLOAD_APPROVED: 'diagnostic-only-v1', CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic-repair-test-token' };
const SOURCE = { head: ENV.WORKERS_CI_COMMIT_SHA, parents: [APPROVED_PARENT] };
const version = '11111111-1111-4111-8111-111111111111', deployment = '22222222-2222-4222-8222-222222222222';
const PATCH = { logpush: false, tail_consumers: [], observability: { enabled: false,
  logs: { enabled: false, invocation_logs: false, persist: false, destinations: [] },
  traces: { enabled: false, persist: false, destinations: [] } } };
function fixture() {
  const state = { settings: { observability: null, logpush: false, tail_consumers: null, tags: ['synthetic-preserved-tag'] },
    deployment: { deployments: [{ id: deployment, strategy: 'percentage', versions: [{ version_id: version, percentage: 100 }] }] },
    calls: [], hook: undefined };
  const fetcher = async (url, options) => {
    const path = new URL(url).pathname.split('/maya-chat')[1]; state.calls.push({ url, options, path });
    const hooked = await state.hook?.(path, options); if (hooked) return hooked;
    if (path === '/deployments' && options.method === 'GET') return Response.json({ success: true, result: state.deployment });
    assert.equal(path, '/script-settings');
    if (options.method === 'PATCH') {
      const patch = JSON.parse(options.body); assert.deepEqual(patch, PATCH);
      state.settings = { ...state.settings, ...patch };
    } else assert.equal(options.method, 'GET');
    return Response.json({ success: true, result: state.settings });
  };
  return { state, run: (override = {}) => repairLogging({ env: ENV, source: SOURCE, bytes, fetcher, ...override }) };
}
test('one fixed logging-only PATCH, then separate readback; no Worker/binding/deployment mutation', async () => {
  const f = fixture(), result = await f.run();
  assert.deepEqual(f.state.calls.map(c => c.options.method + c.path), [
    'GET/deployments','GET/script-settings','GET/deployments','PATCH/script-settings','GET/script-settings','GET/deployments'
  ]);
  assert.equal(result.patchAttempted, true); assert.equal(result.patchAcknowledged, true);
  assert.equal(result.offVerified, true); assert.equal(result.deploymentUnchanged, true);
  assert.equal(f.state.deployment.deployments[0].versions[0].version_id, version);
  assert.deepEqual(f.state.settings.tags, ['synthetic-preserved-tag']);
  for (const c of f.state.calls) {
    assert.equal(new URL(c.url).origin, 'https://api.cloudflare.com'); assert(c.url.includes(`/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/maya-chat/`));
    assert.equal(c.options.redirect, 'error'); assert.equal(c.options.credentials, 'omit');
    assert.equal(c.options.headers.Authorization, 'Bearer ' + ENV.CLOUDFLARE_API_TOKEN);
    if (c.options.method === 'GET') assert.equal(c.options.body, undefined);
    else {
      assert.equal(c.options.headers['Content-Type'], 'application/json');
      const body = JSON.parse(c.options.body);
      assert.deepEqual(Object.keys(body).sort(), ['logpush','observability','tail_consumers']);
      assert(!c.options.body.includes('true')); assert(!c.options.body.includes('binding')); assert(!c.options.body.includes('tag'));
    }
  }
});
test('already explicit OFF is verified without any settings write', async () => {
  const f = fixture(); f.state.settings = structuredClone(PATCH);
  const result = await f.run(); assert.equal(result.patchAttempted, false); assert.equal(result.offVerified, true);
  assert(f.state.calls.every(c => c.options.method === 'GET'));
});
test('source gate refuses arbitrary commits, merge parents, future commits and mismatched CI checkout', async () => {
  for (const source of [undefined, { head: 'c'.repeat(40), parents: [APPROVED_PARENT] }, { head: SOURCE.head, parents: [] },
    { head: SOURCE.head, parents: ['d'.repeat(40)] }, { head: SOURCE.head, parents: [APPROVED_PARENT, APPROVED_PARENT] }]) {
    const f = fixture(); await assert.rejects(f.run({ source }), /REPAIR_SOURCE_NOT_APPROVED/); assert.equal(f.state.calls.length, 0);
  }
  assert.doesNotThrow(() => checkRepairSource(ENV, SOURCE));
});
for (const key of ['WORKERS_CI','CI','WORKERS_CI_BRANCH','WORKERS_CI_COMMIT_SHA','MAYA_UPLOAD_APPROVED','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']) {
  test(`repair missing ${key} makes no API request`, async () => {
    const f = fixture(); await assert.rejects(f.run({ env: { ...ENV, [key]: undefined } })); assert.equal(f.state.calls.length, 0);
  });
}
test('repair corrupted artifact makes no API request', async () => {
  const f = fixture(), changed = Buffer.from(bytes); changed[0] ^= 1;
  await assert.rejects(f.run({ bytes: changed }), /ARTIFACT_MISMATCH/); assert.equal(f.state.calls.length, 0);
});
for (const settings of [{}, { observability: null, logpush: true, tail_consumers: null },
  { observability: { enabled: true }, logpush: false, tail_consumers: null },
  { observability: null, logpush: false, tail_consumers: [{ service: 'private' }] },
  { observability: null, logpush: false, tail_consumers: null, streaming_tail_consumers: [{ service: 'private' }] },
  { observability: null, logpush: false, tail_consumers: null, streaming_tail_consumers: {} }]) {
  test('settings other than diagnosed null state or explicit OFF stop before PATCH', async () => {
    const f = fixture(); f.state.settings = settings; await assert.rejects(f.run(), /REPAIR_UNEXPECTED_SETTINGS/);
    assert(f.state.calls.every(c => c.options.method === 'GET'));
  });
}
test('partial/null/malformed OFF readback is never called verified or accepted as a successful repair', async () => {
  const variants = [
    { observability: null, logpush: false, tail_consumers: null },
    { ...structuredClone(PATCH), tail_consumers: null },
    { ...structuredClone(PATCH), logpush: undefined },
    { ...structuredClone(PATCH), observability: { enabled: false } }
  ];
  for (const settings of variants) {
    assert.equal(explicitOff(settings), false);
    const f = fixture(); f.state.hook = (path, options) => {
      if (path === '/script-settings' && options.method === 'GET' && f.state.calls.some(c => c.options.method === 'PATCH')) {
        return Response.json({ success: true, result: settings });
      }
    };
    await assert.rejects(f.run(), error => error.code === 'REPAIR_OFF_NOT_VERIFIED' && error.repairState.patchAcknowledged === true
      && error.repairState.offVerified === false && error.repairState.deploymentUnchanged === true);
    assert.equal(f.state.calls.filter(c => c.options.method === 'PATCH').length, 1);
  }
});
test('enabled flags and nonempty destination/tail lists cannot pass readback', () => {
  for (const path of [['logpush'], ['observability','enabled'], ['observability','logs','enabled'], ['observability','logs','persist'],
    ['observability','logs','invocation_logs'], ['observability','traces','enabled'], ['observability','traces','persist']]) {
    const settings = structuredClone(PATCH); let object = settings;
    for (const key of path.slice(0,-1)) object = object[key]; object[path.at(-1)] = true;
    assert.equal(explicitOff(settings), false);
  }
  for (const path of [['tail_consumers'], ['streaming_tail_consumers'], ['observability','logs','destinations'], ['observability','traces','destinations']]) {
    const settings = structuredClone(PATCH); let object = settings;
    for (const key of path.slice(0,-1)) object = object[key]; object[path.at(-1)] = ['private'];
    assert.equal(explicitOff(settings), false);
  }
});
test('deployment change before write blocks; after write reports drift without rollback', async () => {
  for (const afterWrite of [false,true]) {
    const f = fixture(); f.state.hook = (path, opts) => {
      if (afterWrite ? opts.method === 'PATCH' : path === '/script-settings') f.state.deployment.deployments[0].id = version;
    };
    await assert.rejects(f.run(), /REPAIR_DEPLOYMENT_CHANGED/);
    assert.equal(f.state.calls.filter(c => c.options.method === 'PATCH').length, afterWrite ? 1 : 0);
    assert(f.state.calls.every(c => ['GET','PATCH'].includes(c.options.method)));
  }
});
test('split traffic is not changed and blocks before settings write', async () => {
  const f = fixture(); f.state.deployment.deployments[0].versions[0].percentage = 50;
  await assert.rejects(f.run(), /SINGLE_ACTIVE_VERSION_REQUIRED/); assert.equal(f.state.calls.length, 1);
});
test('failed/uncertain PATCH does not retry and only exposes safe state', async () => {
  for (const failure of ['network','HTTP','api']) {
    const f = fixture(); f.state.hook = (path, opts) => {
      if (opts.method === 'PATCH') {
        if (failure === 'network') throw Error('PRIVATE_TOKEN');
        if (failure === 'HTTP') return new Response('PRIVATE_TOKEN', { status: 403 });
        return Response.json({ success: false, errors: [{ message: 'PRIVATE_TOKEN' }] });
      }
    };
    await assert.rejects(f.run(), error => {
      assert(!error.message.includes('PRIVATE_TOKEN'));
      assert.equal(error.repairState.patchAttempted, true); assert.equal(error.repairState.patchAcknowledged, false);
      assert.equal(error.repairState.lastRequest, 'settings_patch'); return true;
    });
    assert.equal(f.state.calls.filter(c => c.options.method === 'PATCH').length, 1);
  }
});
test('HTTP redirect is refused, raw response cancelled, no PATCH attempted', async () => {
  let cancelled = 0;
  const fetcher = async () => new Response(new ReadableStream({ cancel() { cancelled++; } }), { status: 302 });
  await assert.rejects(repairLogging({ env: ENV, source: SOURCE, bytes, fetcher }), /REPAIR_API_ERROR/); assert.equal(cancelled, 1);
});
test('report cannot leak raw keys, destinations, tokens, arbitrary field names or unexpected error messages', () => {
  const canary = 'PRIVATE_CANARY'; const report = reportLines({ patchAttempted: canary, lastRequest: canary, httpStatus: canary,
    before: { logpush: canary, [canary]: canary }, after: { [canary]: canary, global_enabled: canary } }).join('\n');
  assert(!report.includes(canary)); assert(report.includes('last_http_status=unknown')); assert(report.includes('global_enabled=invalid'));
  assert.equal(repairErrorCode(new Blocked(canary)), 'REPAIR_FAILED'); assert.equal(repairErrorCode(new Error(canary)), 'REPAIR_FAILED');
});
test('invalid JSON and UTF-8 are bounded generic errors', async () => {
  for (const body of ['{"PRIVATE":', new Uint8Array([255])]) {
    const f = fixture(); await assert.rejects(f.run({ fetcher: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), /REPAIR_BAD_JSON/);
  }
});
test('64 KiB limit cancels oversized streamed API response before a write', async () => {
  let cancelled = 0;
  const f = fixture(); await assert.rejects(f.run({ fetcher: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(65537)); }, cancel() { cancelled++; } }),
    { headers: { 'content-type': 'application/json' } }) }), /REPAIR_RESPONSE_TOO_LARGE/); assert.equal(cancelled, 1);
});
test('deadline bounds hanging preflight and cancels late response without writing', async () => {
  const f = fixture(); let resolve, cancelled = 0;
  f.state.hook = () => new Promise(r => { resolve = r; });
  await assert.rejects(f.run({ timeoutMs: 30 }), error => error.code === 'REPAIR_DEADLINE' && !error.repairState.patchAttempted);
  resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise(setImmediate); assert.equal(cancelled, 1); assert.equal(f.state.calls.length, 1);
});
test('deadline bounds hanging PATCH; possible settings change is preserved without another PATCH', async () => {
  const f = fixture(); let resolve;
  f.state.hook = (path, opts) => opts.method === 'PATCH' ? new Promise(r => { resolve = r; }) : undefined;
  await assert.rejects(f.run({ timeoutMs: 50 }), error => error.code === 'REPAIR_DEADLINE' && error.repairState.patchAttempted && !error.repairState.patchAcknowledged);
  resolve(Response.json({ success: true, result: PATCH })); await new Promise(setImmediate);
  assert.equal(f.state.calls.filter(c => c.options.method === 'PATCH').length, 1);
});
test('body-read deadline and delayed timer response cleanup are bounded', async () => {
  let cancelled = 0;
  await assert.rejects(fixture().run({ timeoutMs: 30, fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled++; } }),
    { headers: { 'content-type': 'application/json' } }) }), /REPAIR_DEADLINE/); assert.equal(cancelled, 1);
  cancelled = 0;
  await assert.rejects(fixture().run({ timeoutMs: 5, fetcher: async () => {
    const until = Date.now() + 20; while (Date.now() < until) { /* blocked timer callback */ }
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } });
  } }), /REPAIR_DEADLINE/); assert.equal(cancelled, 1);
});
test('CLI refuses local execution without printing credentials or raw Git output', () => {
  const result = spawnSync(process.execPath, ['repair-logging.mjs'], { cwd: new URL('.', import.meta.url), env: {}, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'CLOUDFLARE_BUILD_ONLY\nREPAIR_STOPPED_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
});
test('historical repair module never uploads or promotes a Worker', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url)));
  const source = readFileSync(new URL('repair-logging.mjs', import.meta.url), 'utf8');
  assert(!source.includes('uploadOnly')); assert(!source.includes("method: 'POST'"));
});
test('real CLI repair path verifies OFF and emits only safe labels with synthetic Git and API', () => {
  const initial = { observability: null, logpush: false, tail_consumers: null, tags: ['PRIVATE_CLI_CANARY'] };
  const deploymentResult = { deployments: [{ id: deployment, strategy: 'percentage', versions: [{ version_id: version, percentage: 100 }] }] };
  const preload = `import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
    cp.execFileSync=(binary,args)=>{if(binary!=='git')throw Error('unexpected command');
      if(args.join(' ')==='rev-parse HEAD')return '${ENV.WORKERS_CI_COMMIT_SHA}\\n';
      if(args.join(' ')==='cat-file commit HEAD')return 'tree ${'0'.repeat(40)}\\nparent ${APPROVED_PARENT}\\nauthor PRIVATE_CLI_CANARY\\n\\nsubject';throw Error('unexpected Git request');};
    syncBuiltinESMExports();let settings=${JSON.stringify(initial)},patches=0;
    globalThis.fetch=async(url,opts)=>{const path=new URL(url).pathname.split('/maya-chat')[1];
      if(path==='/deployments'&&opts.method==='GET')return Response.json({success:true,result:${JSON.stringify(deploymentResult)}});
      if(path!=='/script-settings')throw Error('wrong endpoint');
      if(opts.method==='PATCH'){if(++patches!==1||JSON.stringify(JSON.parse(opts.body))!==${JSON.stringify(JSON.stringify(PATCH))})throw Error('wrong PATCH');settings={...settings,...JSON.parse(opts.body)};}
      else if(opts.method!=='GET')throw Error('wrong method');return Response.json({success:true,result:settings});};`;
  const result = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(preload), 'repair-logging.mjs'],
    { cwd: new URL('.', import.meta.url), env: ENV, encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  assert(result.stdout.startsWith('MAYA_LOGGING_OFF_REPAIR_V1\n'));
  assert(result.stdout.includes('off_verified=true')); assert(result.stdout.includes('patch_acknowledged=true'));
  assert(result.stdout.includes('after.global_enabled=false')); assert(result.stdout.includes('after.tail_consumers=empty'));
  assert(result.stdout.endsWith('LOGGING_OFF_VERIFIED_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL\n'));
  assert(!result.stdout.includes('PRIVATE_CLI_CANARY')); assert(!result.stdout.includes(ENV.CLOUDFLARE_API_TOKEN));
});
