// Offline routing regression, NOT a model-quality/phone recall test.
// Uses fresh nonextractable synthetic keys, in-memory SQL, and a fake AI binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import worker from '../deploy/maya-chat/worker-upload.mjs';
import { database, key, completion } from '../backend/signed-chat/test-helpers.mjs';
import { signChat, CHAT_PATH } from '../backend/signed-chat/wire.mjs';
import { MODEL, SYSTEM } from '../backend/signed-chat/model.mjs';

let networkAttempts = 0;
const deny = () => { networkAttempts++; throw Error('LIVE_NETWORK_FORBIDDEN'); };
globalThis.fetch = deny;
http.request = http.get = https.request = https.get = deny;
net.connect = net.createConnection = net.Socket.prototype.connect = deny;
const ORIGIN = 'https://maya.test';
const setup = 'Mera code nadi-62 hai. Sirf OK likho.';
const followup = 'Code kya tha?';

for (const secondReply of ['nadi-62', 'OK']) {
  test(`APK signed follow-up preserves all three messages and provider text (${secondReply === 'OK' ? 'incorrect semantics' : 'expected semantics'})`, async t => {
    const { sqlite, DB } = database(); t.after(() => sqlite.close());
    const owner = await key(), apk = await key(), calls = [];
    const expected = [
      [{ role: 'user', content: setup }],
      [{ role: 'user', content: setup }, { role: 'assistant', content: 'OK' }, { role: 'user', content: followup }]
    ];
    const env = {
      DB, APP_ORIGIN: ORIGIN, OWNER_PUBLIC_JWK: JSON.stringify(owner.publicJwk),
      APK_PUBLIC_JWK: JSON.stringify(apk.publicJwk), PAIRING_ENABLED: 'true', ENABLE_CHAT: 'true',
      FREE_PLAN_CONFIRMED: 'true', MODEL_REVIEW_CONFIRMED: 'true', LIVE_AUTH_CHECKS_CONFIRMED: 'true',
      AI: { async run(model, input) {
        const index = calls.length; assert(index < 2, 'No retry or extra model invocation');
        assert.equal(model, MODEL); assert.equal(input.stream, false); assert.equal(input.max_tokens, 256);
        assert.deepEqual(input.messages, [{ role: 'system', content: SYSTEM }, ...expected[index]]);
        calls.push(structuredClone(input));
        return completion(index === 0 ? 'OK' : secondReply);
      } }
    };
    const nonces = [];
    for (let i = 0; i < 2; i++) {
      const body = JSON.stringify({ messages: expected[i] });
      const signed = await signChat(apk, ORIGIN, body);
      nonces.push(signed.headers['X-Maya-Nonce']);
      const response = await worker.fetch(new Request(ORIGIN + CHAT_PATH, {
        ...signed, headers: { ...signed.headers, Origin: ORIGIN }
      }), env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json();
      assert.equal(result.nonce, nonces[i]); assert.equal(result.keyId, apk.keyId);
      assert.equal(result.text, i === 0 ? 'OK' : secondReply);
      assert.equal(result.model, MODEL);
      assert.equal(calls.length, i + 1);
    }
    assert.notEqual(nonces[0], nonces[1]);
    assert.equal(sqlite.prepare('SELECT day_count FROM chat_budget').get().day_count, 2);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM pairing_nonces').get().n, 2);
    // A valid request-bound result can still be semantically wrong. Do not
    // manufacture a code answer, reject repeated words, or retry automatically.
    assert.equal(networkAttempts, 0);
  });
}
