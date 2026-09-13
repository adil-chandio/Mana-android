#!/usr/bin/env node
'use strict';
// Invoked by JVM tests. Public synthetic vectors only; never contacts the Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
let networkAttempted = false;
function blocked() { networkAttempted = true; throw Error('LIVE_NETWORK_BLOCKED'); }
globalThis.fetch = blocked;
for (const name of ['node:http', 'node:https']) { const m = require(name); m.request = blocked; m.get = blocked; }
const ORIGIN = 'https://maya-chat.aadialii424.workers.dev';
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const hash = async bytes => b64(await webcrypto.subtle.digest('SHA-256', bytes));
(async () => {
  const filename = process.argv[2]; assert(filename);
  assert(fs.statSync(filename).size <= 256 * 1024);
  const fixture = JSON.parse(fs.readFileSync(filename, 'utf8'));
  assert.equal(fixture.requests.length, 64);
  const { crv, kty, x, y } = fixture.publicJwk;
  assert.equal(crv, 'P-256'); assert.equal(kty, 'EC');
  assert.deepEqual(Object.keys(fixture.publicJwk).sort(), ['crv', 'kty', 'x', 'y']);
  const publicKey = await webcrypto.subtle.importKey('jwk', fixture.publicJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const keyId = await hash(Buffer.from(JSON.stringify({ crv, kty, x, y })));
  for (const [i, r] of fixture.requests.entries()) {
    assert.equal(r.path, i === 0 ? '/v1/chat/check' : '/v1/chat');
    assert.equal(r.headers.Origin, ORIGIN); assert.equal(r.headers['X-Maya-Key-Id'], keyId);
    assert.deepEqual(Object.keys(r.headers).sort(), ['Content-Type', 'Origin', 'X-Maya-Key-Id', 'X-Maya-Nonce', 'X-Maya-Sent-At', 'X-Maya-Signature'].sort());
    const signature = Buffer.from(r.headers['X-Maya-Signature'], 'base64url'); assert.equal(signature.length, 64);
    assert.equal(b64(signature), r.headers['X-Maya-Signature']);
    const canonical = ['maya-text-chat-v1', 'POST', ORIGIN, r.path, r.headers['X-Maya-Sent-At'],
      r.headers['X-Maya-Nonce'], await hash(Buffer.from(r.body)), keyId].join('\n');
    assert(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, Buffer.from(canonical)));
    assert(!(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, Buffer.from(canonical + 'tampered'))));
    if (i === 0) assert.equal(r.body, '{}');
    else assert.deepEqual(JSON.parse(r.body), { messages: [{ role: 'user', content: `Synthetic native wire ${i} اردو 🔥 "quote"\n` }] });
  }
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE pairing_nonces(key_id TEXT NOT NULL, nonce TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(key_id,nonce));
    CREATE TABLE chat_budget(id INTEGER PRIMARY KEY, utc_day TEXT NOT NULL, day_count INTEGER NOT NULL, minute_id INTEGER NOT NULL, minute_count INTEGER NOT NULL);`);
  const DB = { prepare(sql) { return { bind(...args) { return { sql, args, async first() { return db.prepare(sql).get(...args) ?? null; } }; } }; },
    async batch(rows) { db.exec('BEGIN IMMEDIATE'); try { const results = rows.map(r => ({ success: true, results: db.prepare(r.sql).all(...r.args) })); db.exec('COMMIT'); return results; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
  try {
    const { default: worker } = await import('../deploy/maya-chat/worker-upload.mjs');
    let calls = 0;
    const env = { DB, OWNER_PUBLIC_JWK: JSON.stringify(fixture.publicJwk), PAIRING_ENABLED: 'true', APP_ORIGIN: ORIGIN,
      ENABLE_CHAT: 'true', FREE_PLAN_CONFIRMED: 'true', MODEL_REVIEW_CONFIRMED: 'true', LIVE_AUTH_CHECKS_CONFIRMED: 'true',
      AI: { async run(model, input) { calls++; assert.equal(model, '@cf/qwen/qwen3-30b-a3b-fp8'); assert.equal(input.max_tokens, 256);
        return { object: 'chat.completion', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Synthetic native interoperability reply', tool_calls: null, function_call: null } }] }; } } };
    const invoke = r => worker.fetch(new Request(ORIGIN + r.path, { method: 'POST', body: r.body, headers: r.headers }), env);
    const check = fixture.requests[0], chat = fixture.requests[1];
    assert.equal((await invoke(check)).status, 200); assert.equal(calls, 0);
    assert.equal((await invoke(check)).status, 409); assert.equal(calls, 0);
    const good = await invoke(chat); assert.equal(good.status, 200); assert.equal((await good.json()).text, 'Synthetic native interoperability reply');
    assert.equal(calls, 1); assert.equal((await invoke(chat)).status, 409); assert.equal(calls, 1);
    const changed = structuredClone(fixture.requests[2]); changed.body += ' ';
    const bad = await invoke(changed); assert.equal(bad.status, 401); assert.equal((await bad.json()).error.code, 'BAD_SIGNATURE');
    const unregistered = structuredClone(fixture.requests[3]); unregistered.headers['X-Maya-Key-Id'] = 'X'.repeat(43);
    assert.equal((await invoke(unregistered)).status, 401); assert.equal(calls, 1);
    env.ENABLE_CHAT = 'false'; assert.equal((await invoke(fixture.requests[4])).status, 503); assert.equal(calls, 1);
    assert.equal(db.prepare('SELECT day_count FROM chat_budget').get().day_count, 1);
    assert.equal(networkAttempted, false);
    console.log('NATIVE_WIRE_INTEROP_PASS: 64 input signatures; actual bundled Worker synthetic auth/replay/tamper/budget checks.');
  } finally { db.close(); }
})().catch(() => { console.error('NATIVE_WIRE_INTEROP_FAILED'); process.exitCode = 1; });
process.on('exit', () => { if (networkAttempted) { console.error('UNEXPECTED_NETWORK_ATTEMPT'); process.exitCode = 1; } });
