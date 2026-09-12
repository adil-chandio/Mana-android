import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Blocked, BRANCH } from './upload-version.mjs';
import { projectLogging, diagnoseLogging, diagnosticErrorCode } from './diagnose-logging.mjs';
const bytes = readFileSync(new URL('worker-upload.mjs', import.meta.url));
const ENV = { WORKERS_CI: '1', CI: 'true', WORKERS_CI_BRANCH: BRANCH, WORKERS_CI_COMMIT_SHA: 'a'.repeat(40),
  MAYA_UPLOAD_APPROVED: 'diagnostic-only-v1', CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic-diagnostic-token-only' };
const off = () => ({ observability: { enabled: false }, logpush: false, tail_consumers: [] });
function fixture(settings = off()) {
  const calls = [];
  return { calls, run: (extra = {}) => diagnoseLogging({ env: ENV, bytes, fetcher: async (url, options) => {
    calls.push({ url, options }); return Response.json({ success: true, result: settings });
  }, ...extra }) };
}
test('diagnostic remains exactly one GET even if the old safety guard passes', async () => {
  const f = fixture(), report = await f.run();
  assert.equal(report.previous_guard, 'pass'); assert.equal(f.calls.length, 1);
  const { url, options } = f.calls[0];
  assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${ENV.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/maya-chat/script-settings`);
  assert.equal(options.method, 'GET'); assert.equal(options.body, undefined); assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit'); assert.equal(options.headers.Authorization, `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`);
});
test('guard-blocked diagnostic is still read-only and distinguishes null tail consumers', async () => {
  const settings = off(); settings.tail_consumers = null;
  const f = fixture(settings), report = await f.run();
  assert.equal(report.tail_consumers, 'null'); assert.equal(report.previous_guard, 'blocked'); assert.equal(f.calls.length, 1);
});
test('nested disabled flags are reported without treating them as a fix', () => {
  const report = projectLogging({ observability: { enabled: true, logs: { enabled: false }, traces: { enabled: false } } });
  assert.equal(report.global_enabled, 'true'); assert.equal(report.logs_enabled, 'false'); assert.equal(report.traces_enabled, 'false');
  assert.equal(report.previous_guard, 'blocked');
});
test('missing/null/invalid settings and boolean fields remain distinct', () => {
  for (const [value, label] of [[undefined, 'missing'], [null, 'null'], ['false', 'invalid'], [0, 'invalid'], [[], 'array']]) {
    assert.equal(projectLogging(value).settings, label);
    assert.equal(projectLogging({ observability: value }).observability, label);
  }
  for (const [value, label] of [[undefined, 'missing'], [null, 'null'], ['false', 'invalid'], [false, 'false'], [true, 'true']]) {
    assert.equal(projectLogging({ observability: { enabled: value } }).global_enabled, label);
  }
});
test('projection never leaks destinations, tails, tags, arbitrary field names or secret-looking values', () => {
  const canary = 'PRIVATE_CANARY_DO_NOT_PRINT';
  const report = projectLogging({ [canary]: canary, tags: [canary], logpush: canary, tail_consumers: [{ service: canary }],
    observability: { enabled: canary, logs: { enabled: canary, invocation_logs: canary, persist: true, destinations: [canary] },
      traces: { enabled: false, persist: false, destinations: [canary] } } });
  const text = JSON.stringify(report); assert(!text.includes(canary)); assert(!text.includes('service'));
  assert.equal(report.tail_consumers, 'nonempty'); assert.equal(report.log_destinations, 'nonempty');
  assert.equal(report.trace_destinations, 'nonempty'); assert.equal(report.logpush, 'invalid');
  assert.equal(Object.keys(report).length, 15);
  const labels = new Set(['missing','null','object','array','invalid','true','false','nonempty','empty','pass','blocked']);
  for (const state of Object.values(report)) assert(labels.has(state));
});
test('empty, absent and malformed destinations are distinct without content output', () => {
  for (const [destinations, label] of [[undefined,'missing'], [null,'null'], [[], 'empty'], [['private'], 'nonempty'], [{ secret: 'x' },'invalid']]) {
    const r = projectLogging({ observability: { logs: { destinations }, traces: { destinations } } });
    assert.equal(r.log_destinations, label); assert.equal(r.trace_destinations, label);
  }
});
test('no inherited projection fields are reported', () => {
  const report = projectLogging(Object.create({ observability: { enabled: true }, logpush: true }));
  assert.equal(report.observability, 'missing'); assert.equal(report.logpush, 'missing');
});
for (const key of ['WORKERS_CI','CI','WORKERS_CI_BRANCH','WORKERS_CI_COMMIT_SHA','MAYA_UPLOAD_APPROVED','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']) {
  test(`missing ${key} prevents all diagnostic requests`, async () => {
    const f = fixture(); await assert.rejects(f.run({ env: { ...ENV, [key]: undefined } })); assert.equal(f.calls.length, 0);
  });
}
test('changed Worker artifact prevents all diagnostic requests', async () => {
  const f = fixture(), changed = Buffer.from(bytes); changed[500] ^= 1;
  await assert.rejects(f.run({ bytes: changed }), /ARTIFACT_MISMATCH/); assert.equal(f.calls.length, 0);
});
test('HTTP errors and API success:false are sanitized and never retried', async () => {
  for (const response of [new Response('PRIVATE', { status: 401 }), new Response('PRIVATE', { status: 302 }),
    Response.json({ success: false, errors: [{ message: 'PRIVATE' }] }), Response.json({ success: true, result: null }),
    Response.json({ success: true, result: [] }), new Response('PRIVATE', { headers: { 'content-type': 'text/html' } })]) {
    let count = 0;
    await assert.rejects(diagnoseLogging({ env: ENV, bytes, fetcher: async () => { count++; return response; } }), /DIAGNOSTIC_API_ERROR/);
    assert.equal(count, 1);
  }
});
test('invalid JSON and invalid UTF-8 are sanitized', async () => {
  for (const body of ['{"secret":"PRIVATE"', new Uint8Array([255])]) {
    await assert.rejects(diagnoseLogging({ env: ENV, bytes, fetcher: async () => new Response(body, { headers: { 'content-type': 'application/json' } }) }), /DIAGNOSTIC_BAD_JSON/);
  }
});
test('oversized API body cancels the stream at 64 KiB', async () => {
  let cancelled = 0;
  const fetcher = async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(65537)); }, cancel() { cancelled++; } }),
    { headers: { 'content-type': 'application/json' } });
  await assert.rejects(diagnoseLogging({ env: ENV, bytes, fetcher }), /DIAGNOSTIC_RESPONSE_TOO_LARGE/); assert.equal(cancelled, 1);
});
test('deadline bounds hanging fetch; late response is cancelled without follow-up calls', async () => {
  let resolve, cancelled = 0, count = 0;
  const pending = diagnoseLogging({ env: ENV, bytes, timeoutMs: 30, fetcher: () => { count++; return new Promise(r => { resolve = r; }); } });
  await assert.rejects(pending, /DIAGNOSTIC_DEADLINE/);
  resolve(new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise(setImmediate); assert.equal(cancelled, 1); assert.equal(count, 1);
});
test('deadline also bounds a hanging response body', async () => {
  let cancelled = 0;
  await assert.rejects(diagnoseLogging({ env: ENV, bytes, timeoutMs: 30, fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled++; } }),
    { headers: { 'content-type': 'application/json' } }) }), /DIAGNOSTIC_DEADLINE/);
  assert.equal(cancelled, 1);
});
test('unexpected exceptions, including forged Blocked messages, cannot escape into logs', async () => {
  for (const error of [new Error('PRIVATE'), new Blocked('PRIVATE')]) {
    assert.equal(diagnosticErrorCode(error), 'DIAGNOSTIC_FAILED');
    await assert.rejects(diagnoseLogging({ env: ENV, bytes, fetcher: async () => { throw error; } }), /^Error: DIAGNOSTIC_FAILED$/);
  }
});
test('local CLI refuses credentials-free execution without emitting report or raw errors', () => {
  const result = spawnSync(process.execPath, ['diagnose-logging.mjs'], { cwd: new URL('.', import.meta.url), env: {}, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'CLOUDFLARE_BUILD_ONLY_READ_ONLY_NO_UPLOAD');
});
test('dashboard npm run upload command is now diagnostic-only, with no fallback uploader', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url)));
  assert.equal(pkg.scripts.upload, 'npm run check && node diagnose-logging.mjs');
  assert.equal(pkg.scripts.test, 'node --test upload.test.mjs diagnostic.test.mjs');
  assert.equal(pkg.dependencies, undefined);
  const source = readFileSync(new URL('diagnose-logging.mjs', import.meta.url), 'utf8');
  assert(!source.includes('uploadOnly')); assert(!source.includes("method: 'POST'"));
  assert(!source.includes('process.env.') && source.includes('env: process.env'));
});
test('elapsed deadline cancels a response even before a delayed timer callback fires', async () => {
  let cancelled = 0;
  const fetcher = async () => {
    const until = Date.now() + 20; while (Date.now() < until) { /* simulate blocked event loop */ }
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } });
  };
  await assert.rejects(diagnoseLogging({ env: ENV, bytes, fetcher, timeoutMs: 5 }), /DIAGNOSTIC_DEADLINE/);
  assert.equal(cancelled, 1);
});
test('real CLI prints only whitelisted status lines and explicit no-upload marker', () => {
  const payload = { success: true, result: { ...off(), tail_consumers: null, private_field: 'PRIVATE_CLI_CANARY' } };
  const code = `globalThis.fetch=async (url,options)=>{if(options.method!=='GET'||!url.endsWith('/maya-chat/script-settings'))throw Error('wrong request');return Response.json(${JSON.stringify(payload)});};`;
  const preload = 'data:text/javascript,' + encodeURIComponent(code);
  const result = spawnSync(process.execPath, ['--import', preload, 'diagnose-logging.mjs'], { cwd: new URL('.', import.meta.url), env: ENV, encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  const lines = result.stdout.trim().split('\n'); assert.equal(lines.length, 17);
  assert.equal(lines[0], 'MAYA_LOGGING_DIAGNOSTIC_V1');
  assert.equal(lines.at(-1), 'READ_ONLY_COMPLETE_NO_UPLOAD_NO_DEPLOY_NO_AI_CALL');
  assert(lines.includes('tail_consumers=null')); assert(lines.includes('previous_guard=blocked'));
  assert(!result.stdout.includes('PRIVATE_CLI_CANARY')); assert(!result.stdout.includes(ENV.CLOUDFLARE_API_TOKEN));
});
