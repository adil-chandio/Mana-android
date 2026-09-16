import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandler } from './worker.mjs';
import bundled from './worker-upload.mjs';
import pairing from '../pairing/worker.mjs';
import { database, clock, key, deferred, completion } from './test-helpers.mjs';
import { signChat, CHAT_PATH, CHECK_PATH, canonical } from './wire.mjs';
import { signRequest, decode64, base64url, hash } from '../pairing/shared.mjs';
import { LIMITS } from '../chat/protocol.mjs';
import { MODEL } from './model.mjs';
const ORIGIN = 'https://maya.test';
const BODY = JSON.stringify({ messages: [{ role: 'user', content: 'Synthetic test only.' }] });
async function fixture(t) {
  const { sqlite, DB } = database(), time = clock(), owner = await key(), calls = [];
  t.after(() => sqlite.close());
  const env = { PAIRING_ENABLED: 'true', ENABLE_CHAT: 'true', FREE_PLAN_CONFIRMED: 'true', MODEL_REVIEW_CONFIRMED: 'true',
    LIVE_AUTH_CHECKS_CONFIRMED: 'true', APP_ORIGIN: ORIGIN, OWNER_PUBLIC_JWK: JSON.stringify(owner.publicJwk), DB,
    AI: { async run(...args) { calls.push(args); return completion(); } } };
  const invoke = createHandler({ clock: time });
  return { sqlite, DB, time, owner, calls, env, invoke: req => invoke(req, env),
    signed: (body = BODY, path = CHAT_PATH, record = owner, extra = {}) => signChat(record, ORIGIN, body, { path, timestamp: time.now(), ...extra }),
    req(options, path = CHAT_PATH, headers = {}) { return new Request(ORIGIN + path, { ...options, headers: { ...options.headers, Origin: ORIGIN, ...headers } }); },
    count: () => sqlite.prepare('SELECT count(*) AS n FROM pairing_nonces').get().n,
    budget: () => sqlite.prepare('SELECT day_count FROM chat_budget').get()?.day_count || 0 };
}
async function code(response, status, expected, outcome = 'not_dispatched') {
  assert.equal(response.status, status); const data = await response.json();
  assert.equal(data.error.code, expected); assert.equal(data.error.automaticRetry, false); assert.equal(data.error.providerOutcome, outcome); return data;
}
test('signed text invokes exactly one fixed model, preserves raw signed text, returns bound non-tool response', async t => {
  const f = await fixture(t), options = await f.signed(), response = await f.invoke(f.req(options)), data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.model, MODEL); assert.equal(data.nonce, options.headers['X-Maya-Nonce']);
  assert.equal(data.keyId, f.owner.keyId); assert.equal(data.capabilities.tools, false); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], MODEL); assert.equal(f.calls[0][1].stream, false); assert.equal(f.calls[0][1].max_tokens, 256);
  assert.deepEqual(f.calls[0][1].messages.slice(1), JSON.parse(BODY).messages); assert.equal(f.count(), 1); assert.equal(f.budget(), 1);
  assert.equal(f.time.tasks.size, 0); assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
for (const flag of ['ENABLE_CHAT', 'FREE_PLAN_CONFIRMED', 'MODEL_REVIEW_CONFIRMED', 'LIVE_AUTH_CHECKS_CONFIRMED']) {
  test(`${flag} absent/false/non-string keeps inference closed`, async t => {
    const f = await fixture(t);
    for (const value of [undefined, 'false', true, 'TRUE']) {
      f.env[flag] = value; await code(await f.invoke(f.req(await f.signed())), 503, 'CHAT_NOT_ENABLED');
    }
    assert.equal(f.count(), 0); assert.equal(f.budget(), 0); assert.equal(f.calls.length, 0);
  });
}
test('no AI binding remains disabled and unread body is cancelled', async t => {
  const f = await fixture(t); delete f.env.AI; let cancelled = 0;
  const body = new ReadableStream({ cancel() { cancelled++; } });
  await code(await f.invoke(new Request(ORIGIN + CHAT_PATH, { method: 'POST', body, duplex: 'half' })), 503, 'CHAT_NOT_ENABLED');
  assert.equal(cancelled, 1);
});
test('empty diagnostics work without AI flags/binding, consume replay only; exact repeat is 409', async t => {
  const f = await fixture(t); for (const name of ['ENABLE_CHAT', 'FREE_PLAN_CONFIRMED', 'MODEL_REVIEW_CONFIRMED', 'LIVE_AUTH_CHECKS_CONFIRMED', 'AI']) delete f.env[name];
  const options = await f.signed('{}', CHECK_PATH), r = await f.invoke(f.req(options, CHECK_PATH));
  assert.equal(r.status, 200); assert.equal((await r.json()).aiConnected, false);
  await code(await f.invoke(f.req(options, CHECK_PATH)), 409, 'REPLAY_OR_WINDOW_FULL');
  assert.equal(f.budget(), 0); assert.equal(f.calls.length, 0); assert.equal(f.count(), 1);
});
test('PAIRING_ENABLED switch closes chat and diagnostics; reopening uses same key', async t => {
  const f = await fixture(t); f.env.PAIRING_ENABLED = 'false';
  await code(await f.invoke(f.req(await f.signed())), 503, 'SETUP_REQUIRED');
  await code(await f.invoke(f.req(await f.signed('{}', CHECK_PATH), CHECK_PATH)), 503, 'SETUP_REQUIRED');
  f.env.PAIRING_ENABLED = 'true'; assert.equal((await f.invoke(f.req(await f.signed()))).status, 200);
});
test('unregistered key, forged identity headers and altered key ID never spend quota', async t => {
  const f = await fixture(t), other = await key(), options = await f.signed(BODY, CHAT_PATH, other);
  await code(await f.invoke(f.req(options, CHAT_PATH, { 'Cf-Access-Authenticated-User-Email': 'owner@example.test', Authorization: 'Bearer fake' })), 401, 'SIGNATURE_REQUIRED');
  options.headers['X-Maya-Key-Id'] = f.owner.keyId;
  await code(await f.invoke(f.req(options)), 401, 'BAD_SIGNATURE'); assert.equal(f.count(), 0); assert.equal(f.budget(), 0);
});
test('remove/rotate/restore owner config rejects old signatures; never registers caller keys', async t => {
  const f = await fixture(t), options = await f.signed(), original = f.env.OWNER_PUBLIC_JWK;
  delete f.env.OWNER_PUBLIC_JWK; await code(await f.invoke(f.req(options)), 503, 'SETUP_REQUIRED');
  f.env.OWNER_PUBLIC_JWK = JSON.stringify((await key()).publicJwk); await code(await f.invoke(f.req(options)), 401, 'SIGNATURE_REQUIRED');
  f.env.OWNER_PUBLIC_JWK = original; assert.equal((await f.invoke(f.req(options))).status, 200);
});
test('private, extra, corrupt, oversize or non-string owner configuration fails closed', async t => {
  const f = await fixture(t);
  for (const owner of [{ ...f.owner.publicJwk, d: 'secret' }, { ...f.owner.publicJwk, extra: 1 }, { ...f.owner.publicJwk, x: 'bad' }]) {
    f.env.OWNER_PUBLIC_JWK = JSON.stringify(owner); await code(await f.invoke(f.req(await f.signed())), 503, 'INVALID_OWNER_CONFIGURATION');
  }
  f.env.OWNER_PUBLIC_JWK = 'x'.repeat(513); await code(await f.invoke(f.req(await f.signed())), 503, 'INVALID_OWNER_CONFIGURATION');
  f.env.OWNER_PUBLIC_JWK = f.owner.publicJwk; await code(await f.invoke(f.req(await f.signed())), 503, 'SETUP_REQUIRED');
});
test('same-origin HTTPS/exact target gates including queries, fragments and content path', async t => {
  const f = await fixture(t), options = await f.signed();
  for (const path of [CHAT_PATH + '?x=1', CHAT_PATH + '#x']) await code(await f.invoke(f.req(options, path)), 403, 'ORIGIN_OR_TARGET_DENIED');
  for (const origin of ['null', 'https://other.test', ORIGIN + '/']) await code(await f.invoke(f.req(options, CHAT_PATH, { Origin: origin })), 403, 'ORIGIN_OR_TARGET_DENIED');
  f.env.APP_ORIGIN = ORIGIN + '/'; await code(await f.invoke(f.req(options)), 403, 'ORIGIN_OR_TARGET_DENIED');
  f.env.APP_ORIGIN = 'http://maya.test'; await code(await f.invoke(new Request('http://maya.test' + CHAT_PATH, { ...options, headers: { ...options.headers, Origin: f.env.APP_ORIGIN } })), 403, 'ORIGIN_OR_TARGET_DENIED');
});
test('POST only and unknown routes never call AI', async t => {
  const f = await fixture(t);
  for (const method of ['GET', 'OPTIONS', 'PUT']) await code(await f.invoke(new Request(ORIGIN + CHAT_PATH, { method })), 405, 'POST_ONLY');
  assert.equal((await f.invoke(new Request(ORIGIN + '/v1/register', { method: 'POST' }))).status, 404); assert.equal(f.calls.length, 0);
});
test('pairing-domain and check-path signatures cannot authorize chat', async t => {
  const f = await fixture(t);
  const old = await signRequest(f.owner, ORIGIN, BODY, { path: CHAT_PATH, timestamp: f.time.now() });
  await code(await f.invoke(f.req(old)), 401, 'BAD_SIGNATURE');
  const check = await f.signed(BODY, CHECK_PATH); await code(await f.invoke(f.req(check)), 401, 'BAD_SIGNATURE');
  const options = await f.signed(); await code(await f.invoke(f.req(options, CHECK_PATH)), 401, 'BAD_SIGNATURE');
  assert.equal(f.count(), 0);
});
test('message and whitespace tampering after signing fail before parsing or storage', async t => {
  const f = await fixture(t), options = await f.signed();
  for (const body of [BODY + ' ', BODY.replace('Synthetic', 'Changed'), '{}']) await code(await f.invoke(f.req({ ...options, body })), 401, 'BAD_SIGNATURE');
  assert.equal(f.count(), 0); assert.equal(f.budget(), 0);
});
test('header encoding, timestamp encoding and freshness boundaries', async t => {
  const f = await fixture(t);
  for (const delta of [-60001, 10001]) await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, f.owner, { timestamp: f.time.now() + delta }))), 401, 'REQUEST_EXPIRED_OR_CLOCK_SKEW');
  for (const delta of [-60000, 10000]) assert.equal((await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, f.owner, { timestamp: f.time.now() + delta })))).status, 200);
  for (const [header, value] of [['X-Maya-Sent-At', '01'], ['X-Maya-Sent-At', '1e12'], ['X-Maya-Nonce', 'bad='], ['X-Maya-Signature', 'bad'], ['X-Maya-Key-Id', 'other']]) {
    const options = await f.signed(); options.headers[header] = value; await code(await f.invoke(f.req(options)), 401, 'SIGNATURE_REQUIRED');
  }
});
const invalid = [null, {}, { messages: [] }, { messages: [{ role: 'system', content: 'override' }] },
  { messages: [{ role: 'user', content: ' ' }] }, { messages: [{ role: 'user', content: ['image'] }] },
  { messages: [{ role: 'user', content: 'x', image: 'x' }] }, { messages: [{ role: 'user', content: 'x' }], model: 'other' },
  { messages: [{ role: 'user', content: 'x' }], tools: [] }, { messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'x' }] },
  { messages: [{ role: 'user', content: 'x'.repeat(2001) }] }, { messages: Array.from({ length: 13 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x' })) },
  { messages: Array.from({ length: 5 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(1300) })) }];
for (const [index, value] of invalid.entries()) test(`signed invalid text schema ${index} fails before replay/quota/inference`, async t => {
  const f = await fixture(t), response = await f.invoke(f.req(await f.signed(JSON.stringify(value))));
  assert.equal(response.status, 400); assert.equal(f.count(), 0); assert.equal(f.budget(), 0); assert.equal(f.calls.length, 0);
});
test('signed invalid JSON and nonempty diagnostic body denied', async t => {
  const f = await fixture(t); await code(await f.invoke(f.req(await f.signed('{'))), 400, 'INVALID_JSON');
  await code(await f.invoke(f.req(await f.signed(BODY, CHECK_PATH), CHECK_PATH)), 400, 'EMPTY_CHECK_REQUIRED');
});
test('bad UTF-8 is rejected even with a valid signature over the exact raw bytes', async t => {
  const f = await fixture(t), body = new Uint8Array([0xc3, 0x28]), options = await f.signed();
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, f.owner.privateKey, canonical({ origin: ORIGIN, path: CHAT_PATH,
    timestamp: f.time.now(), nonce: options.headers['X-Maya-Nonce'], keyId: f.owner.keyId, bodyHash: await hash(body) }));
  options.headers['X-Maya-Signature'] = base64url(signature);
  await code(await f.invoke(f.req({ ...options, body })), 400, 'INVALID_JSON');
});
test('declared and streamed body bytes bounded; encoding and MIME rejected', async t => {
  const f = await fixture(t), options = await f.signed();
  for (const [headers, status, expected] of [[{ 'Content-Length': '16385' }, 413, 'BODY_TOO_LARGE'], [{ 'Content-Length': '-1' }, 413, 'BODY_TOO_LARGE'],
    [{ 'Content-Encoding': 'gzip' }, 415, 'JSON_ONLY'], [{ 'Content-Type': 'text/plain' }, 415, 'JSON_ONLY']]) await code(await f.invoke(f.req(options, CHAT_PATH, headers)), status, expected);
  let cancelled = 0;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(16385)); }, cancel() { cancelled++; } });
  await code(await f.invoke(new Request(ORIGIN + CHAT_PATH, { ...options, headers: { ...options.headers, Origin: ORIGIN }, body, duplex: 'half' })), 413, 'BODY_TOO_LARGE');
  assert.equal(cancelled, 1); assert.equal(f.count(), 0);
});
test('concurrent duplicate requests across handlers invoke AI and charge once', async t => {
  const f = await fixture(t), options = await f.signed(), other = createHandler({ clock: f.time });
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? other(f.req(options), f.env) : f.invoke(f.req(options)))));
  assert.equal(results.filter(r => r.status === 200).length, 1); assert.equal(results.filter(r => r.status === 409).length, 7);
  assert.equal(f.calls.length, 1); assert.equal(f.budget(), 1);
});
test('alternate-S ECDSA signature cannot bypass nonce replay ledger', async t => {
  const f = await fixture(t), options = await f.signed(); assert.equal((await f.invoke(f.req(options))).status, 200);
  const sig = decode64(options.headers['X-Maya-Signature'], 64), order = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  const s = BigInt('0x' + Buffer.from(sig.subarray(32)).toString('hex')); sig.set(Buffer.from((order - s).toString(16).padStart(64, '0'), 'hex'), 32);
  options.headers['X-Maya-Signature'] = base64url(sig); await code(await f.invoke(f.req(options)), 409, 'REPLAY_OR_WINDOW_FULL'); assert.equal(f.calls.length, 1);
});
test('replay capacity and lazy cleanup cannot bypass quota', async t => {
  const f = await fixture(t), insert = f.sqlite.prepare('INSERT INTO pairing_nonces VALUES (?, ?, ?)');
  for (let i = 0; i < 256; i++) insert.run(f.owner.keyId, String(i).padStart(32, '0'), f.time.now() + 1);
  await code(await f.invoke(f.req(await f.signed())), 409, 'REPLAY_OR_WINDOW_FULL'); assert.equal(f.budget(), 0);
  f.time.advance(2); assert.equal((await f.invoke(f.req(await f.signed()))).status, 200); assert.equal(f.count(), 1);
});
test('same nonce shared across pairing/chat check cannot be reused for inference', async t => {
  const f = await fixture(t), options = await f.signed('{}', CHECK_PATH);
  assert.equal((await f.invoke(f.req(options, CHECK_PATH))).status, 200);
  const chat = await f.signed(BODY, CHAT_PATH, f.owner, { nonce: options.headers['X-Maya-Nonce'] });
  await code(await f.invoke(f.req(chat)), 409, 'REPLAY_OR_WINDOW_FULL'); assert.equal(f.calls.length, 0);
});
test('replay-store failure/malformed results never charge quota or expose exceptions', async t => {
  const f = await fixture(t);
  for (const result of [null, [{ success: true }], [null, null], [{ success: true }, { success: false, results: [] }]]) {
    f.env.DB = { ...f.DB, async batch() { return result; } }; await code(await f.invoke(f.req(await f.signed())), 503, 'REPLAY_STORE_UNAVAILABLE');
  }
  f.env.DB = { ...f.DB, async batch() { throw Error('PRIVATE SENTINEL'); } };
  const r = await f.invoke(f.req(await f.signed())); assert(!JSON.stringify(await code(r, 503, 'REPLAY_STORE_UNAVAILABLE')).includes('SENTINEL')); assert.equal(f.budget(), 0);
});
test('concurrent unique requests respect 5/minute; limit errors cannot replay consumed nonce', async t => {
  const f = await fixture(t), options = await Promise.all(Array.from({ length: 9 }, () => f.signed()));
  const results = await Promise.all(options.map(o => f.invoke(f.req(o))));
  assert.equal(results.filter(r => r.status === 200).length, 5); assert.equal(results.filter(r => r.status === 429).length, 4);
  const i = results.findIndex(r => r.status === 429); await code(await f.invoke(f.req(options[i])), 409, 'REPLAY_OR_WINDOW_FULL');
  assert.equal(f.calls.length, 5); assert.equal(f.budget(), 5); f.time.advance(60000);
  assert.equal((await f.invoke(f.req(await f.signed()))).status, 200);
});
test('daily cap and forward-only budget windows remain enforced', async t => {
  const f = await fixture(t), day = new Date(f.time.now()).toISOString().slice(0, 10), minute = Math.floor(f.time.now() / 60000);
  f.sqlite.prepare('INSERT INTO chat_budget VALUES (1, ?, 50, ?, 1)').run(day, minute - 1);
  await code(await f.invoke(f.req(await f.signed())), 429, 'REQUEST_LIMIT');
  f.time.advance(86400000); assert.equal((await f.invoke(f.req(await f.signed()))).status, 200); assert.equal(f.budget(), 1);
  f.time.advance(-60000); await code(await f.invoke(f.req(await f.signed())), 429, 'REQUEST_LIMIT'); assert.equal(f.budget(), 1);
});
test('missing budget schema fails closed after nonce; same request still cannot replay', async t => {
  const f = await fixture(t), options = await f.signed(); f.sqlite.exec('DROP TABLE chat_budget');
  await code(await f.invoke(f.req(options)), 503, 'BUDGET_UNAVAILABLE'); await code(await f.invoke(f.req(options)), 409, 'REPLAY_OR_WINDOW_FULL'); assert.equal(f.calls.length, 0);
});
for (const output of [null, {}, { response: '' }, { response: 'x'.repeat(8001) }, { response: 'x', tool_calls: [{}] }, { response: 'x', tool_calls: {} }]) {
  test(`invalid provider output ${output === null ? 'null' : Object.keys(output).join('/')} is safe and quota retained`, async t => {
    const f = await fixture(t); f.env.AI.run = async () => output;
    await code(await f.invoke(f.req(await f.signed())), 502, 'INVALID_MODEL_RESPONSE', 'unknown_or_completed'); assert.equal(f.budget(), 1);
  });
}
test('model exception never leaks content, retries or refunds', async t => {
  const f = await fixture(t); let n = 0; f.env.AI.run = async () => { n++; throw Error('SECRET provider raw data'); };
  const data = await code(await f.invoke(f.req(await f.signed())), 502, 'MODEL_UNAVAILABLE', 'unknown_or_completed');
  assert(!JSON.stringify(data).includes('SECRET')); assert.equal(n, 1); assert.equal(f.budget(), 1);
});
test('pre-abort prevents storage/inference and clears timer', async t => {
  const f = await fixture(t), abort = new AbortController(); abort.abort();
  await code(await f.invoke(f.req({ ...await f.signed(), signal: abort.signal })), 499, 'STOPPED_LOCALLY');
  assert.equal(f.count(), 0); assert.equal(f.time.tasks.size, 0);
});
test('hanging streamed body times out, cancels reader and never dispatches', async t => {
  const f = await fixture(t), entered = deferred(); let cancelled = 0;
  const body = new ReadableStream({ pull() { entered.resolve(); }, cancel() { cancelled++; } });
  const options = await f.signed();
  const response = f.invoke(new Request(ORIGIN + CHAT_PATH, { ...options, headers: { ...options.headers, Origin: ORIGIN }, body, duplex: 'half' }));
  await entered.promise; // pull may occur before crypto verification, but all stages share the timer
  await new Promise(setImmediate); f.time.advance(12000);
  await code(await response, 504, 'DEADLINE_EXCEEDED'); assert.equal(cancelled, 1); assert.equal(f.calls.length, 0); assert.equal(f.time.tasks.size, 0);
});
for (const stage of ['replay', 'budget', 'model']) for (const kind of ['stop', 'deadline', 'late-timer']) {
  test(`${kind} during ${stage} fences late completion, cleans lifecycle and preserves uncertainty`, async t => {
    const f = await fixture(t), gate = deferred(), entered = deferred(), abort = new AbortController();
    if (stage === 'replay') f.env.DB = { ...f.DB, async batch(s) { entered.resolve(); await gate.promise; return f.DB.batch(s); } };
    if (stage === 'budget') f.env.DB = { ...f.DB, prepare(sql) { const statement = f.DB.prepare(sql); return { bind(...args) { const bound = statement.bind(...args); return sql.includes('chat_budget') ? { ...bound, async first() { entered.resolve(); await gate.promise; return bound.first(); } } : bound; } }; } };
    if (stage === 'model') f.env.AI.run = async () => { f.calls.push('dispatched'); entered.resolve(); await gate.promise; return completion('late'); };
    const pending = f.invoke(f.req({ ...await f.signed(), signal: abort.signal })); await entered.promise;
    if (kind === 'stop') abort.abort(); else f.time.advance(12000, kind !== 'late-timer');
    if (kind === 'late-timer') gate.resolve();
    await code(await pending, kind === 'stop' ? 499 : 504, kind === 'stop' ? 'STOPPED_LOCALLY' : 'DEADLINE_EXCEEDED', stage === 'model' ? 'unknown_or_completed' : 'not_dispatched');
    gate.resolve(); await new Promise(setImmediate); assert.equal(f.calls.length, stage === 'model' ? 1 : 0); assert.equal(f.time.tasks.size, 0);
    if (stage !== 'replay') assert.equal(f.budget(), 1);
  });
}
test('static assets preserve original pairing page/keys; health invokes no AI; closed bundle', async () => {
  for (const path of ['/', '/style.css', '/app.mjs', '/keys.mjs', '/shared.mjs']) {
    const a = await bundled.fetch(new Request(ORIGIN + path)), b = await pairing.fetch(new Request(ORIGIN + path));
    assert.equal(await a.text(), await b.text());
  }
  const page = await bundled.fetch(new Request(ORIGIN + '/chat')); assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.match(await page.text(), /No model response verified/);
  const response = await bundled.fetch(new Request(ORIGIN + CHAT_PATH, { method: 'POST' })); await code(response, 503, 'CHAT_NOT_ENABLED');
  const h = await (await bundled.fetch(new Request(ORIGIN + '/chat/health'))).json(); assert.equal(h.liveConnectionVerified, false); assert.equal(h.inferenceInvoked, false);
  assert.match(readFileSync(new URL('wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_CHAT": "false"/);
});
test('malformed budget acknowledgement fails closed rather than authorizing inference', async t => {
  const f = await fixture(t);
  f.env.DB = { ...f.DB, prepare(sql) { const s = f.DB.prepare(sql); return { bind(...args) { const bound = s.bind(...args); return sql.includes('chat_budget') ? { ...bound, async first() { return {}; } } : bound; } }; } };
  await code(await f.invoke(f.req(await f.signed())), 503, 'BUDGET_UNAVAILABLE'); assert.equal(f.calls.length, 0); assert.equal(f.count(), 1);
});
test('nonce prune and unique claim roll back together if D1 transaction fails', async t => {
  const f = await fixture(t), nonce = 'a'.repeat(32);
  f.sqlite.prepare('INSERT INTO pairing_nonces VALUES (?, ?, ?)').run(f.owner.keyId, nonce, f.time.now() - 1);
  f.sqlite.exec("CREATE TRIGGER reject_claim BEFORE INSERT ON pairing_nonces BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;");
  await code(await f.invoke(f.req(await f.signed())), 503, 'REPLAY_STORE_UNAVAILABLE'); assert.equal(f.count(), 1); assert.equal(f.budget(), 0);
});
test('UTF-8 wire size and schema limits are independent', async t => {
  const f = await fixture(t), body = JSON.stringify({ messages: [{ role: 'user', content: '\u0001'.repeat(1900) },
    { role: 'assistant', content: '\u0001'.repeat(1900) }, { role: 'user', content: 'test' }] });
  assert(body.length > LIMITS.bodyBytes); await code(await f.invoke(f.req(await f.signed(body))), 413, 'BODY_TOO_LARGE'); assert.equal(f.calls.length, 0);
});
test('generated bundle and every build input match their recorded SHA256; HTML/CSS match source', async () => {
  const { createHash } = await import('node:crypto');
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const inputs = JSON.parse(readFileSync(new URL('build-inputs.json', import.meta.url), 'utf8'));
  for (const [file, expected] of Object.entries(inputs)) assert.equal(digest(readFileSync(new URL('../../' + file, import.meta.url))), expected, file + ' requires rebuild');
  const [expected] = readFileSync(new URL('ARTIFACT.sha256', import.meta.url), 'utf8').split(/\s/);
  assert.equal(digest(readFileSync(new URL('worker-upload.mjs', import.meta.url))), expected);
  for (const [url, file] of [['/chat', 'web/index.html'], ['/chat/style.css', 'web/style.css']]) {
    assert.equal(await (await bundled.fetch(new Request(ORIGIN + url))).text(), readFileSync(new URL(file, import.meta.url), 'utf8'));
  }
});

test('Qwen final text alone is returned; reasoning and provider metadata never leak', async t => {
  const f = await fixture(t);
  f.env.AI.run = async (...args) => {
    f.calls.push(args); const out = completion('Ji, synthetic jawab.');
    out.choices[0].message.reasoning_content = 'DO_NOT_EXPOSE_REASONING';
    out.provider_secret = 'DO_NOT_EXPOSE_METADATA'; return out;
  };
  const response = await f.invoke(f.req(await f.signed()));
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.text, 'Ji, synthetic jawab.'); assert.equal(data.model, MODEL);
  assert(!JSON.stringify(data).includes('DO_NOT_EXPOSE')); assert.equal(f.calls.length, 1);
});
for (const [label, mutate] of [
  ['length finish', o => { o.choices[0].finish_reason = 'length'; }],
  ['nested tool', o => { o.choices[0].message.tool_calls = [{ function: { name: 'not_executed' } }]; }],
  ['reasoning-only', o => { o.choices[0].message.content = ''; o.choices[0].message.reasoning_content = 'DO_NOT_EXPOSE'; }],
  ['inline reasoning', o => { o.choices[0].message.content = '<think>DO_NOT_EXPOSE</think>answer'; }],
]) test(`Qwen ${label} fails after one dispatch, retains quota/nonce, never retries`, async t => {
  const f = await fixture(t); let calls = 0;
  f.env.AI.run = async () => { calls++; const o = completion(); mutate(o); return o; };
  const signed = await f.signed();
  const data = await code(await f.invoke(f.req(signed)), 502, 'INVALID_MODEL_RESPONSE', 'unknown_or_completed');
  assert(!JSON.stringify(data).includes('DO_NOT_EXPOSE')); assert.equal(f.budget(), 1);
  await code(await f.invoke(f.req(signed)), 409, 'REPLAY_OR_WINDOW_FULL'); assert.equal(calls, 1);
});

test('validation diagnostic returns only a fixed category after authorization and one dispatch', async t => {
  const f = await fixture(t); let n = 0;
  f.env.AI.run = async () => { n++; return { response: 'PRIVATE_RESPONSE_CANARY', PRIVATE_KEY: 'PRIVATE_METADATA' }; };
  const signed = await f.signed();
  const data = await code(await f.invoke(f.req(signed)), 502, 'INVALID_MODEL_RESPONSE', 'unknown_or_completed');
  assert.equal(data.error.validationReason, 'RESPONSE_STYLE_ENVELOPE');
  assert.deepEqual(Object.keys(data.error).sort(), ['automaticRetry', 'code', 'providerOutcome', 'validationReason']);
  assert(!JSON.stringify(data).includes('PRIVATE_')); assert.equal(n, 1); assert.equal(f.budget(), 1);
  const repeated = await code(await f.invoke(f.req(signed)), 409, 'REPLAY_OR_WINDOW_FULL');
  assert.equal(repeated.error.validationReason, undefined); assert.equal(n, 1);
});
test('provider exceptions cannot forge diagnostic labels and are never echoed', async t => {
  const f = await fixture(t);
  f.env.AI.run = async () => { throw Object.assign(Error('PRIVATE_RAW_ERROR'), { validationReason: 'FINISH_LENGTH', code: 'INVALID_MODEL_RESPONSE' }); };
  const data = await code(await f.invoke(f.req(await f.signed())), 502, 'MODEL_UNAVAILABLE', 'unknown_or_completed');
  assert.equal(data.error.validationReason, undefined); assert(!JSON.stringify(data).includes('PRIVATE_'));
});
test('Chat OFF and unregistered callers never obtain output categories or call the provider', async t => {
  const f = await fixture(t); f.env.ENABLE_CHAT = 'false';
  const off = await code(await f.invoke(f.req(await f.signed())), 503, 'CHAT_NOT_ENABLED');
  assert.equal(off.error.validationReason, undefined);
  f.env.ENABLE_CHAT = 'true';
  const other = await key();
  const denied = await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, other))), 401, 'SIGNATURE_REQUIRED');
  assert.equal(denied.error.validationReason, undefined); assert.equal(f.calls.length, 0); assert.equal(f.budget(), 0);
});

for (const variant of [{ tool_calls: null }, { function_call: null }, { tool_calls: null, function_call: null }]) {
  test('nullable message fields return only final text after one authorized dispatch; quota/replay unchanged', async t => {
    const f = await fixture(t); let calls = 0;
    f.env.AI.run = async (model, input) => {
      calls++; assert.equal(model, MODEL); assert.equal(input.max_tokens, 256); assert.equal(input.stream, false);
      const out = completion('Synthetic nullable final');
      Object.assign(out.choices[0].message, variant, { reasoning_content: 'PRIVATE_NULL_REASONING' });
      out.private_metadata = 'PRIVATE_NULL_METADATA'; return out;
    };
    const signed = await f.signed(), response = await f.invoke(f.req(signed)), data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.text, 'Synthetic nullable final');
    assert.equal(data.capabilities.tools, false); assert.equal(data.error, undefined);
    assert(!JSON.stringify(data).includes('PRIVATE_NULL')); assert.equal(f.budget(), 1); assert.equal(calls, 1);
    await code(await f.invoke(f.req(signed)), 409, 'REPLAY_OR_WINDOW_FULL'); assert.equal(calls, 1);
  });
}
test('one null field cannot hide a real function request in the other field', async t => {
  const f = await fixture(t); let calls = 0;
  f.env.AI.run = async () => { calls++; const out = completion(); Object.assign(out.choices[0].message,
    { tool_calls: null, function_call: { name: 'PRIVATE_FORBIDDEN_FUNCTION', arguments: 'PRIVATE_ARGUMENTS' } }); return out; };
  const signed = await f.signed(), data = await code(await f.invoke(f.req(signed)), 502, 'INVALID_MODEL_RESPONSE', 'unknown_or_completed');
  assert.equal(data.error.validationReason, 'MESSAGE_TOOLS'); assert(!JSON.stringify(data).includes('PRIVATE_'));
  assert.equal(calls, 1); assert.equal(f.budget(), 1);
});

test('optional native key slot authorizes a separate key, preserves browser and shares quota', async t => {
  const f = await fixture(t), apk = await key(), stranger = await key();
  await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, apk))), 401, 'SIGNATURE_REQUIRED');
  f.env.APK_PUBLIC_JWK = JSON.stringify(apk.publicJwk);
  const signed = await f.signed(BODY, CHAT_PATH, apk);
  assert.equal((await f.invoke(f.req(signed))).status, 200);
  await code(await f.invoke(f.req(signed)), 409, 'REPLAY_OR_WINDOW_FULL');
  assert.equal((await f.invoke(f.req(await f.signed()))).status, 200);
  assert.equal(f.budget(), 2); assert.equal(f.calls.length, 2);
  await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, stranger))), 401, 'SIGNATURE_REQUIRED');
  delete f.env.APK_PUBLIC_JWK;
  await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, apk))), 401, 'SIGNATURE_REQUIRED');
  assert.equal((await f.invoke(f.req(await f.signed()))).status, 200);
});
test('native empty check accepts once, denies replay and never spends AI quota', async t => {
  const f = await fixture(t), apk = await key(); f.env.APK_PUBLIC_JWK = JSON.stringify(apk.publicJwk); f.env.ENABLE_CHAT = 'false';
  const signed = await f.signed('{}', CHECK_PATH, apk);
  assert.equal((await f.invoke(f.req(signed, CHECK_PATH))).status, 200);
  await code(await f.invoke(f.req(signed, CHECK_PATH)), 409, 'REPLAY_OR_WINDOW_FULL');
  assert.equal(f.budget(), 0); assert.equal(f.calls.length, 0);
});
test('bad/duplicate/private APK configuration fails closed for APK, leaves browser usable', async t => {
  const f = await fixture(t), apk = await key();
  for (const value of ['', null, true, 'x'.repeat(513), JSON.stringify(f.owner.publicJwk), JSON.stringify({ ...apk.publicJwk, d: 'PRIVATE' }), '{}', JSON.stringify(apk.publicJwk).replace('{', '{"x":"duplicate",'), JSON.stringify(apk.publicJwk).replace('{', '{"\\u0078":"duplicate",')]) {
    f.env.APK_PUBLIC_JWK = value;
    await code(await f.invoke(f.req(await f.signed('{}', CHECK_PATH, apk), CHECK_PATH)), 503, 'INVALID_APK_CONFIGURATION');
    assert.equal((await f.invoke(f.req(await f.signed('{}', CHECK_PATH), CHECK_PATH))).status, 200);
  }
  assert.equal(f.budget(), 0); assert.equal(f.calls.length, 0);
});
test('native key keeps Origin, signature, global rate and Chat-OFF guards', async t => {
  const f = await fixture(t), apk = await key(); f.env.APK_PUBLIC_JWK = JSON.stringify(apk.publicJwk);
  const badOrigin = f.req(await f.signed(BODY, CHAT_PATH, apk), CHAT_PATH, { Origin: 'https://evil.test' });
  await code(await f.invoke(badOrigin), 403, 'ORIGIN_OR_TARGET_DENIED');
  const altered = await f.signed(BODY, CHAT_PATH, apk); altered.body += ' ';
  await code(await f.invoke(f.req(altered)), 401, 'BAD_SIGNATURE');
  for (let i = 0; i < 5; i++) assert.equal((await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, i % 2 ? apk : f.owner)))).status, 200);
  await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, apk))), 429, 'REQUEST_LIMIT');
  f.env.ENABLE_CHAT = 'false'; await code(await f.invoke(f.req(await f.signed(BODY, CHAT_PATH, apk))), 503, 'CHAT_NOT_ENABLED');
  assert.equal(f.calls.length, 5);
});
