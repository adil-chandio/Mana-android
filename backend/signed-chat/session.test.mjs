import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatSession } from './session.mjs';
import { signChat, CHAT_PATH, CHECK_PATH } from './wire.mjs';
import { createHandler } from './worker.mjs';
import { key, clock, database, deferred, completion } from './test-helpers.mjs';
import { MODEL } from './model.mjs';
const ORIGIN = 'https://maya.test';
function model(options, text = 'Synthetic answer') {
  return Response.json({ kind: 'model-response', model: MODEL, text, keyId: options.headers['X-Maya-Key-Id'],
    nonce: options.headers['X-Maya-Nonce'], capabilities: { text: true, tools: false, vision: false, voice: false } });
}
async function fixture(t, changes = {}) {
  const owner = await key(), time = clock(), { DB, sqlite } = database(), requests = [], modelCalls = [];
  t.after(() => sqlite.close());
  const env = { PAIRING_ENABLED: 'true', ENABLE_CHAT: 'true', FREE_PLAN_CONFIRMED: 'true', MODEL_REVIEW_CONFIRMED: 'true',
    LIVE_AUTH_CHECKS_CONFIRMED: 'true', APP_ORIGIN: ORIGIN, OWNER_PUBLIC_JWK: JSON.stringify(owner.publicJwk), DB,
    AI: { async run(_, input) { modelCalls.push(input); return completion(); } } };
  const handler = createHandler({ clock: time });
  const opts = { origin: ORIGIN, loadKey: async () => owner, clock: time,
    signer: (record, origin, body, options) => signChat(record, origin, body, { ...options, timestamp: time.now() }),
    fetcher: async (url, options) => { requests.push({ url, options }); return handler(new Request(url, { ...options, headers: { ...options.headers, Origin: ORIGIN } }), env); }, ...changes };
  return { owner, time, DB, sqlite, requests, modelCalls, env, opts, session: new ChatSession(opts) };
}
test('no key loading/signing/network at construction; explicit text consent required', async t => {
  let loads = 0; const f = await fixture(t, { loadKey: async () => { loads++; return null; } });
  assert.equal(loads, 0); assert.equal(f.requests.length, 0);
  assert.equal((await f.session.send('hello')).code, 'CONSENT_REQUIRED'); assert.equal(loads, 0);
  assert.equal((await f.session.send('hello', true)).code, 'KEY_REQUIRED'); assert.equal(f.requests.length, 0); assert.equal(f.time.tasks.size, 0);
});
test('real session signs exact bounded messages, excludes fetch credentials/redirects and keeps history only in memory', async t => {
  const f = await fixture(t); assert.equal((await f.session.send('hello', true)).ok, true);
  assert.equal((await f.session.send('next', true)).ok, true);
  const { options, url } = f.requests[1]; assert.equal(url, ORIGIN + CHAT_PATH);
  assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.equal(options.mode, 'same-origin');
  assert.equal(JSON.parse(options.body).messages.length, 3); assert.equal(f.modelCalls.length, 2);
  assert.equal(f.session.snapshot().contextCount, 4); assert.equal(f.time.tasks.size, 0);
  const snapshot = f.session.snapshot(); snapshot.messages[0].content = 'tampered'; assert.equal(f.session.snapshot().messages[0].content, 'hello');
});
test('checkReplay signs one empty payload twice, no conversation/AI/budget use', async t => {
  const f = await fixture(t); delete f.env.AI; delete f.env.ENABLE_CHAT;
  assert.equal((await f.session.checkReplay()).ok, true); assert.equal(f.session.snapshot().status, 'replay_checked');
  assert.equal(f.requests.length, 2); assert(f.requests.every(r => r.url === ORIGIN + CHECK_PATH && r.options.body === '{}'));
  assert.deepEqual(f.requests[0].options.headers, f.requests[1].options.headers); assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM chat_budget').get().n, 0);
});
test('diagnostic stops after first denial, never retries or changes registration', async t => {
  const f = await fixture(t); f.env.OWNER_PUBLIC_JWK = JSON.stringify((await key()).publicJwk);
  assert.equal((await f.session.checkReplay()).code, 'SIGNATURE_REQUIRED'); assert.equal(f.requests.length, 1);
});
test('diagnostic cannot call success when repeat is accepted or an unrelated failure occurs', async t => {
  const f = await fixture(t); let n = 0;
  f.session.fetcher = async (_url, options) => {
    n++; return Response.json({ kind: 'chat-auth-verified', aiConnected: false, keyId: options.headers['X-Maya-Key-Id'], nonce: options.headers['X-Maya-Nonce'] });
  };
  assert.equal((await f.session.checkReplay()).code, 'REPLAY_CHECK_FAILED'); assert.equal(n, 2);
});
test('single-flight rejects rapid double click; STOP while loading prevents late signing/fetch', async t => {
  const gate = deferred(), entered = deferred(), f = await fixture(t, { loadKey: async () => { entered.resolve(); return gate.promise; } });
  const pending = f.session.send('first', true); await entered.promise;
  assert.equal((await f.session.send('second', true)).code, 'BUSY'); assert.equal((await f.session.checkReplay()).code, 'BUSY');
  f.session.stop(); assert.equal(f.session.snapshot().busy, false); assert.equal((await pending).code, 'STOPPED_LOCALLY');
  gate.resolve(f.owner); await new Promise(setImmediate); assert.equal(f.requests.length, 0); assert.equal(f.session.snapshot().contextCount, 0); assert.equal(f.time.tasks.size, 0);
});
for (const stage of ['load', 'sign', 'fetch', 'body']) for (const event of ['stop', 'deadline']) {
  test(`${event} during ${stage} fences stale work and cancels bounded response reading`, async t => {
    const gate = deferred(), entered = deferred(), f = await fixture(t); let cancelled = 0, signedOptions;
    if (stage === 'load') f.session.loadKey = async () => { entered.resolve(); await gate.promise; return f.owner; };
    if (stage === 'sign') f.session.signer = async (...args) => { entered.resolve(); await gate.promise; return f.opts.signer(...args); };
    if (stage === 'fetch') f.session.fetcher = async (_url, options) => { signedOptions = options; entered.resolve(); await gate.promise; return model(options, 'late'); };
    if (stage === 'body') f.session.fetcher = async (_url, options) => { signedOptions = options; return new Response(new ReadableStream({ pull() { entered.resolve(); }, cancel() { cancelled++; } }), { headers: { 'Content-Type': 'application/json' } }); };
    const pending = f.session.send('first', true); await entered.promise;
    if (event === 'stop') f.session.stop(); else f.time.advance(20000);
    assert.equal((await pending).code, event === 'stop' ? 'STOPPED_LOCALLY' : 'DEADLINE_EXCEEDED');
    assert.equal(f.session.snapshot().providerOutcome, ['fetch', 'body'].includes(stage) ? 'unknown_or_completed' : 'not_dispatched');
    gate.resolve(); await new Promise(setImmediate); assert.equal(f.session.snapshot().contextCount, 0); assert.equal(f.time.tasks.size, 0);
    if (signedOptions) assert.equal(signedOptions.signal.aborted, true);
    if (stage === 'body') assert.equal(cancelled, 1);
  });
}
test('elapsed deadline is checked before late fetch even when timer callback is delayed', async t => {
  const f = await fixture(t), gate = deferred(), entered = deferred();
  f.session.signer = async (...args) => { entered.resolve(); await gate.promise; return f.opts.signer(...args); };
  const pending = f.session.send('hello', true); await entered.promise; f.time.advance(20000, false); gate.resolve();
  assert.equal((await pending).code, 'DEADLINE_EXCEEDED'); assert.equal(f.requests.length, 0); assert.equal(f.time.tasks.size, 0);
});
test('aborted old reply cannot overwrite a newer turn or add old context', async t => {
  const f = await fixture(t), gate = deferred(), entered = deferred(); let n = 0;
  f.session.fetcher = async (_url, options) => { if (++n === 1) { entered.resolve(); await gate.promise; return model(options, 'old reply'); } return model(options, 'new reply'); };
  const old = f.session.send('old question', true); await entered.promise; f.session.stop(); await old;
  assert.equal((await f.session.send('new question', true)).ok, true); gate.resolve(); await new Promise(setImmediate);
  assert.deepEqual(f.session.history.map(m => m.content), ['new question', 'new reply']);
  assert.equal(f.session.snapshot().messages.at(-1).content, 'new reply'); assert(!f.session.snapshot().messages.some(m => m.content === 'old reply'));
});
test('failed/unknown request is never automatically retried or added to later context', async t => {
  const f = await fixture(t); let n = 0;
  f.session.fetcher = async (_url, options) => { if (++n === 1) throw Error('sensitive exception'); return model(options); };
  assert.equal((await f.session.send('failed', true)).code, 'NETWORK_UNCERTAIN'); assert.equal(n, 1);
  assert.equal((await f.session.send('next', true)).ok, true); assert.equal(n, 2); assert.equal(f.session.history.length, 2); assert.equal(f.session.history[0].content, 'next');
});
test('disabled server errors state no dispatch, keep failed text out of context', async t => {
  const f = await fixture(t); f.env.ENABLE_CHAT = 'false';
  assert.equal((await f.session.send('test', true)).code, 'CHAT_NOT_ENABLED'); assert.equal(f.session.snapshot().providerOutcome, 'not_dispatched');
  assert.equal(f.session.history.length, 0); assert.equal(f.modelCalls.length, 0);
});
for (const variant of ['wrong nonce', 'wrong key', 'wrong model', 'tools', 'empty', 'huge', 'html', 'invalid json', 'oversize json', 'wrong error', 'wrong status']) {
  test(`rejects ${variant} server reply without committing conversation`, async t => {
    const f = await fixture(t);
    f.session.fetcher = async (_url, options) => {
      const data = await model(options).json();
      if (variant === 'wrong nonce') data.nonce = 'other'; if (variant === 'wrong key') data.keyId = 'other';
      if (variant === 'wrong model') data.model = 'other'; if (variant === 'tools') data.capabilities.tools = true;
      if (variant === 'empty') data.text = ''; if (variant === 'huge') data.text = 'x'.repeat(8001);
      if (variant === 'html') return new Response('<script>secret</script>', { headers: { 'Content-Type': 'text/html' } });
      if (variant === 'invalid json') return new Response('{', { headers: { 'Content-Type': 'application/json' } });
      if (variant === 'oversize json') return new Response(' '.repeat(65537), { headers: { 'Content-Type': 'application/json' } });
      if (variant === 'wrong error') return Response.json({ error: { code: 'private details', automaticRetry: true } }, { status: 500 });
      return Response.json(data, { status: variant === 'wrong status' ? 201 : 200 });
    };
    assert.equal((await f.session.send('test', true)).code, 'INVALID_SERVER_RESPONSE'); assert.equal(f.session.history.length, 0); assert.equal(f.time.tasks.size, 0);
  });
}
test('messages, history and UTF-8 bytes are validated before signing/network; no silent context trim', async t => {
  const f = await fixture(t);
  for (const text of ['', ' ', 'x'.repeat(2001), null]) assert.equal((await f.session.send(text, true)).code, 'INVALID_MESSAGES');
  assert.equal(f.requests.length, 0);
  f.session.history = Array.from({ length: 4 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(1500) }));
  assert.equal((await f.session.send('next', true)).code, 'CONTEXT_LIMIT'); assert.equal(f.requests.length, 0);
  f.session.history = [{ role: 'user', content: '𐀀'.repeat(900) }, { role: 'assistant', content: '𐀀'.repeat(900) }];
  // JSON control escaping, rather than JS string length, can cross 16 KiB.
  f.session.history = [{ role: 'user', content: '\u0001'.repeat(1900) }, { role: 'assistant', content: '\u0001'.repeat(1900) }];
  assert.equal((await f.session.send('next', true)).code, 'BODY_TOO_LARGE'); assert.equal(f.requests.length, 0);
});
test('long model answer is shown completely but requires new context before follow-up', async t => {
  const f = await fixture(t); let n = 0; f.session.fetcher = async (_url, options) => { n++; return model(options, 'x'.repeat(2001)); };
  assert.equal((await f.session.send('test', true)).ok, true); assert.equal(f.session.snapshot().messages.at(-1).content.length, 2001);
  assert.equal((await f.session.send('next', true)).code, 'CONTEXT_LIMIT'); assert.equal(n, 1);
});
test('clear/foreign-key-change fences pending work and forgets conversation but not stored key', async t => {
  const gate = deferred(), entered = deferred(), f = await fixture(t);
  f.session.fetcher = async (_url, options) => { entered.resolve(); await gate.promise; return model(options); };
  const p = f.session.send('test', true); await entered.promise; f.session.clear('KEY_CHANGED'); await p;
  gate.resolve(); await new Promise(setImmediate); assert.equal(f.session.snapshot().messages.length, 0); assert.equal(f.session.history.length, 0);
  assert.equal(f.session.snapshot().code, 'KEY_CHANGED'); assert.equal(f.session.snapshot().providerOutcome, 'unknown_or_completed'); assert.equal(await f.session.loadKey(), f.owner); assert.equal(f.time.tasks.size, 0);
});
test('non-HTTPS/alternate target cannot load a key or sign/send', async t => {
  const f = await fixture(t, { origin: 'http://maya.test' });
  assert.equal((await f.session.send('test', true)).code, 'INVALID_TARGET'); assert.equal(f.requests.length, 0);
});
test('late response body is cancelled when elapsed deadline beats a throttled timer callback', async t => {
  const f = await fixture(t), gate = deferred(), entered = deferred(); let cancelled = 0;
  f.session.fetcher = async () => { entered.resolve(); await gate.promise; return new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'Content-Type': 'application/json' } }); };
  const pending = f.session.send('test', true); await entered.promise; f.time.advance(20000, false); gate.resolve();
  assert.equal((await pending).code, 'DEADLINE_EXCEEDED'); assert.equal(cancelled, 1); assert.equal(f.time.tasks.size, 0);
});
test('oversized declared response cancels unread stream without displaying any payload', async t => {
  const f = await fixture(t); let cancelled = 0;
  f.session.fetcher = async () => new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'Content-Type': 'application/json', 'Content-Length': '65537' } });
  assert.equal((await f.session.send('test', true)).code, 'INVALID_SERVER_RESPONSE'); assert.equal(cancelled, 1); assert.equal(f.session.history.length, 0);
});
test('context entry cap rejects further sends without silently dropping completed turns', async t => {
  const f = await fixture(t); f.session.fetcher = async (_url, options) => model(options, 'small synthetic answer');
  for (let i = 0; i < 6; i++) assert.equal((await f.session.send('q' + i, true)).ok, true);
  assert.equal((await f.session.send('q6', true)).code, 'CONTEXT_LIMIT'); assert.equal(f.session.history.length, 12);
});
test('failed message display is bounded and explicitly counts discarded display entries', async t => {
  const f = await fixture(t); f.session.fetcher = async () => { throw Error('offline'); };
  for (let i = 0; i < 28; i++) await f.session.send('synthetic ' + i, true);
  assert.equal(f.session.snapshot().messages.length, 24); assert.equal(f.session.snapshot().displayDropped, 4); assert.equal(f.session.history.length, 0);
});
test('STOP between diagnostic requests suppresses the second request; no AI uncertainty claimed', async t => {
  const f = await fixture(t), original = f.session.request.bind(f.session);
  f.session.request = async (...args) => { const result = await original(...args); f.session.stop(); return result; };
  assert.equal((await f.session.checkReplay()).code, 'STOPPED_LOCALLY'); assert.equal(f.requests.length, 1); assert.equal(f.session.snapshot().providerOutcome, 'not_dispatched');
});
test('unknown key-storage errors are generic and never expose exception text or dispatch', async t => {
  const f = await fixture(t, { loadKey: async () => { throw Error('PRIVATE STORAGE SENTINEL'); } });
  assert.equal((await f.session.send('test', true)).code, 'SERVICE_UNAVAILABLE'); assert(!JSON.stringify(f.session.snapshot()).includes('SENTINEL')); assert.equal(f.requests.length, 0);
});

test('Qwen reasoning never enters browser history or the next signed conversation', async t => {
  const f = await fixture(t);
  f.env.AI.run = async (_, input) => {
    f.modelCalls.push(input); const out = completion('Final synthetic answer.');
    out.choices[0].message.reasoning_content = 'DO_NOT_EXPOSE_REASONING'; return out;
  };
  assert.equal((await f.session.send('first', true)).ok, true);
  assert.equal((await f.session.send('second', true)).ok, true);
  assert(!JSON.stringify(f.session.snapshot()).includes('DO_NOT_EXPOSE'));
  assert(!f.requests[1].options.body.includes('DO_NOT_EXPOSE'));
});
test('Qwen truncation stays failed and is not included in future context', async t => {
  const f = await fixture(t);
  f.env.AI.run = async () => { const out = completion('partial answer'); out.choices[0].finish_reason = 'length'; return out; };
  assert.equal((await f.session.send('first', true)).code, 'INVALID_MODEL_RESPONSE');
  assert.equal(f.session.snapshot().contextCount, 0); assert.equal(f.requests.length, 1);
  assert.equal(f.session.snapshot().providerOutcome, 'unknown_or_completed');
});

test('safe validation category reaches UI state only, not history or the next request; resets on success', async t => {
  const f = await fixture(t);
  f.env.AI.run = async () => ({ response: 'PRIVATE_RESPONSE' });
  assert.equal((await f.session.send('synthetic first', true)).code, 'INVALID_MODEL_RESPONSE');
  assert.equal(f.session.snapshot().validationReason, 'RESPONSE_STYLE_ENVELOPE');
  assert.equal(f.session.snapshot().contextCount, 0); assert(!JSON.stringify(f.session.snapshot()).includes('PRIVATE_'));
  f.env.AI.run = async () => completion();
  assert.equal((await f.session.send('synthetic second', true)).ok, true);
  assert.equal(f.session.snapshot().validationReason, null);
  assert(!f.requests[1].options.body.includes('RESPONSE_STYLE_ENVELOPE')); assert(!f.requests[1].options.body.includes('PRIVATE_'));
});
test('clear, local validation failure and a new no-AI check do not leave a stale model diagnostic', async t => {
  const f = await fixture(t); f.env.AI.run = async () => ({ response: 'PRIVATE' });
  await f.session.send('one', true); assert.equal(f.session.snapshot().validationReason, 'RESPONSE_STYLE_ENVELOPE');
  await f.session.send('two', false); assert.equal(f.session.snapshot().validationReason, null);
  await f.session.send('three', true); f.session.clear(); assert.equal(f.session.snapshot().validationReason, null);
  await f.session.send('four', true); await f.session.checkReplay(); assert.equal(f.session.snapshot().validationReason, null);
});
for (const reason of ['<img src=x onerror=alert(1)>', '__proto__', 'constructor', {}, null]) {
  test(`untrusted diagnostic value ${typeof reason} is not reflected by client`, async t => {
    const f = await fixture(t, { fetcher: async () => Response.json({ error: { code: 'INVALID_MODEL_RESPONSE',
      automaticRetry: false, providerOutcome: 'unknown_or_completed', validationReason: reason } }, { status: 502 }) });
    assert.equal((await f.session.send('synthetic', true)).code, 'INVALID_SERVER_RESPONSE');
    assert.equal(f.session.snapshot().validationReason, null);
    assert(!JSON.stringify(f.session.snapshot()).includes('<img'));
  });
}
test('old generic model error stays compatible; categories on unrelated errors are rejected', async t => {
  const f = await fixture(t, { fetcher: async () => Response.json({ error: { code: 'INVALID_MODEL_RESPONSE',
    automaticRetry: false, providerOutcome: 'unknown_or_completed' } }, { status: 502 }) });
  assert.equal((await f.session.send('one', true)).code, 'INVALID_MODEL_RESPONSE');
  assert.equal(f.session.snapshot().validationReason, null);
  f.session.fetcher = async () => Response.json({ error: { code: 'CHAT_NOT_ENABLED', automaticRetry: false,
    providerOutcome: 'not_dispatched', validationReason: 'FINISH_LENGTH' } }, { status: 503 });
  assert.equal((await f.session.send('two', true)).code, 'INVALID_SERVER_RESPONSE');
  assert.equal(f.session.snapshot().validationReason, null);
});

test('local duration includes key loading, signing and full response body; timing never goes on wire', async t => {
  const f = await fixture(t), signer = f.session.signer;
  f.session.loadKey = async () => { f.time.advance(100); return f.owner; };
  f.session.signer = async (...args) => { f.time.advance(200); return signer(...args); };
  f.session.fetcher = async (_url, options) => {
    assert.deepEqual(Object.keys(JSON.parse(options.body)), ['messages']);
    assert(!Object.keys(options.headers).some(k => /timing|elapsed|duration/i.test(k)));
    f.time.advance(300);
    const bytes = new TextEncoder().encode(JSON.stringify(await model(options).json()));
    return new Response(new ReadableStream({ start(controller) {
      f.time.advance(634); controller.enqueue(bytes); controller.close();
    } }), { headers: { 'Content-Type': 'application/json' } });
  };
  assert.equal(f.session.snapshot().elapsedMs, null);
  assert.equal((await f.session.send('Synthetic timed turn', true)).ok, true);
  assert.equal(f.session.snapshot().elapsedMs, 1234);
  assert.equal(f.session.snapshot().contextCount, 2);
  assert(f.session.history.every(m => Object.keys(m).sort().join() === 'content,role'));
  const snapshot = f.session.snapshot(); snapshot.elapsedMs = -1;
  assert.equal(f.session.snapshot().elapsedMs, 1234); assert.equal(f.time.tasks.size, 0);
});
for (const event of ['stop', 'deadline', 'network', 'denied', 'invalid']) test(`local wait ends on ${event}, not a model-speed claim`, async t => {
  const f = await fixture(t), gate = deferred(), entered = deferred(); let calls = 0;
  f.session.fetcher = async () => {
    calls++; entered.resolve(); await gate.promise;
    if (event === 'network') throw Error('PRIVATE_ERROR');
    if (event === 'denied') return Response.json({ error: { code: 'CHAT_NOT_ENABLED', automaticRetry: false, providerOutcome: 'not_dispatched' } }, { status: 503 });
    return Response.json({ PRIVATE_FIELD: 'PRIVATE_RESPONSE' });
  };
  const pending = f.session.send('Synthetic test', true); await entered.promise;
  assert.equal(f.session.snapshot().elapsedMs, null);
  f.time.advance(event === 'deadline' ? 20000 : 432);
  if (event === 'stop') f.session.stop();
  gate.resolve(); const result = await pending;
  assert.equal(result.ok, false); assert.equal(f.session.snapshot().elapsedMs, event === 'deadline' ? 20000 : 432);
  assert.equal(f.session.snapshot().contextCount, 0); assert.equal(calls, 1);
  assert(!JSON.stringify(f.session.snapshot()).includes('PRIVATE_')); assert.equal(f.time.tasks.size, 0);
});
test('new attempt, preflight refusal, access check, clear and new session remove stale timings', async t => {
  const f = await fixture(t), signer = f.session.signer;
  f.session.signer = async (...args) => { f.time.advance(12); return signer(...args); };
  await f.session.send('First synthetic turn', true); assert.equal(f.session.snapshot().elapsedMs, 12);
  assert.equal((await f.session.send('No consent')).code, 'CONSENT_REQUIRED'); assert.equal(f.session.snapshot().elapsedMs, null);
  await f.session.send('Second synthetic turn', true); assert.equal(f.session.snapshot().elapsedMs, 12);
  await f.session.checkReplay(); assert.equal(f.session.snapshot().elapsedMs, null);
  f.session.clear(); assert.equal(f.session.snapshot().elapsedMs, null);
  assert.equal(new ChatSession(f.opts).snapshot().elapsedMs, null);
});
test('late old response cannot overwrite a new turn duration or history', async t => {
  const f = await fixture(t), gate = deferred(), entered = deferred(); let n = 0;
  f.session.fetcher = async (_url, options) => {
    if (++n === 1) { entered.resolve(); await gate.promise; return model(options, 'Old synthetic reply'); }
    f.time.advance(50); return model(options, 'New synthetic reply');
  };
  const old = f.session.send('Old synthetic turn', true); await entered.promise; f.time.advance(100); f.session.stop(); await old;
  assert.equal(f.session.snapshot().elapsedMs, 100);
  await f.session.send('New synthetic turn', true); assert.equal(f.session.snapshot().elapsedMs, 50);
  f.time.advance(2000); gate.resolve(); await new Promise(setImmediate);
  assert.equal(f.session.snapshot().elapsedMs, 50);
  assert.deepEqual(f.session.history.map(m => m.content), ['New synthetic turn', 'New synthetic reply']);
});
test('default browser clock is monotonic; wire timestamps remain epoch milliseconds', async t => {
  const owner = await key(); let captured;
  const session = new ChatSession({ origin: ORIGIN, loadKey: async () => owner,
    fetcher: async (_url, options) => { captured = options; return model(options); } });
  const lower = performance.now(), reading = session.clock.now(), upper = performance.now();
  assert(reading >= lower && reading <= upper);
  const before = Date.now(); assert.equal((await session.send('Synthetic time domain check', true)).ok, true);
  const timestamp = Number(captured.headers['X-Maya-Sent-At']); assert(timestamp >= before && timestamp <= Date.now());
  assert(Number.isFinite(session.snapshot().elapsedMs) && session.snapshot().elapsedMs >= 0);
});
test('completed context survives an intervening failure exactly; failed turn and timing never enter follow-up', async t => {
  const f = await fixture(t), bodies = []; let n = 0;
  f.session.fetcher = async (_url, options) => {
    bodies.push(JSON.parse(options.body)); f.time.advance(10);
    if (++n === 2) throw Error('Synthetic network failure');
    return model(options, n === 1 ? 'Synthetic acknowledgement' : 'neela-kaghaz-47');
  };
  await f.session.send('Synthetic test phrase: neela-kaghaz-47', true);
  assert.equal((await f.session.send('Failed synthetic question', true)).code, 'NETWORK_UNCERTAIN');
  assert.equal(f.session.snapshot().contextCount, 2);
  await f.session.send('What was my synthetic test phrase?', true);
  assert.deepEqual(bodies[2], { messages: [
    { role: 'user', content: 'Synthetic test phrase: neela-kaghaz-47' },
    { role: 'assistant', content: 'Synthetic acknowledgement' },
    { role: 'user', content: 'What was my synthetic test phrase?' }
  ] });
  assert.equal(n, 3); assert.equal(f.session.snapshot().contextCount, 4);
  assert.equal(f.session.snapshot().elapsedMs, 10);
});
