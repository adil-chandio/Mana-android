import { publicJwk, fingerprint, hash, decode64, PAST_MS, FUTURE_MS } from '../pairing/shared.mjs';
import { PRUNE, CLAIM } from '../pairing/auth.mjs';
import { Failure, LIMITS, validateMessages } from '../chat/protocol.mjs';
import { canonical, CHAT_PATH, CHECK_PATH } from './wire.mjs';
function fresh(timestamp, now) {
  if (timestamp < now - PAST_MS || timestamp > now + FUTURE_MS) throw new Failure(401, 'REQUEST_EXPIRED_OR_CLOCK_SKEW');
}
async function readBytes(request, scope, limit) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
      || ![null, 'identity'].includes(request.headers.get('content-encoding'))) throw new Failure(415, 'JSON_ONLY');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new Failure(413, 'BODY_TOO_LARGE');
  if (!request.body) throw new Failure(400, 'INVALID_JSON');
  const reader = request.body.getReader(), chunks = []; let size = 0;
  scope.onClose(() => { reader.cancel().catch(() => {}); });
  try {
    while (true) {
      const { done, value } = await reader.read(); scope.check();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { reader.cancel().catch(() => {}); throw new Failure(413, 'BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function authorize(request, env, scope, clock) {
  const url = new URL(request.url);
  if (env.PAIRING_ENABLED !== 'true' || typeof env.APP_ORIGIN !== 'string'
      || typeof env.OWNER_PUBLIC_JWK !== 'string' || !env.DB?.prepare || !env.DB?.batch) throw new Failure(503, 'SETUP_REQUIRED');
  if (url.protocol !== 'https:' || env.APP_ORIGIN !== url.origin || request.headers.get('origin') !== url.origin
      || url.search || url.hash || ![CHAT_PATH, CHECK_PATH].includes(url.pathname) || request.method !== 'POST') throw new Failure(403, 'ORIGIN_OR_TARGET_DENIED');
  let owner, key;
  try {
    if (env.OWNER_PUBLIC_JWK.length > 512) throw Error();
    owner = publicJwk(JSON.parse(env.OWNER_PUBLIC_JWK));
    key = await crypto.subtle.importKey('jwk', owner, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch { throw new Failure(503, 'INVALID_OWNER_CONFIGURATION'); }
  scope.check();
  let keyId = await fingerprint(owner); scope.check();
  // A separate optional APK slot never replaces the established browser owner.
  // Bad APK configuration blocks non-owner requests, not the existing browser.
  if (request.headers.get('x-maya-key-id') !== keyId && env.APK_PUBLIC_JWK !== undefined) {
    let apk, apkKey, apkId;
    try {
      if (typeof env.APK_PUBLIC_JWK !== 'string' || env.APK_PUBLIC_JWK.length > 512) throw Error();
      if (!/^\s*\{\s*"(?:crv|kty|x|y)"\s*:\s*"[A-Za-z0-9_-]+"\s*(?:,\s*"(?:crv|kty|x|y)"\s*:\s*"[A-Za-z0-9_-]+"\s*){3}\}\s*$/.test(env.APK_PUBLIC_JWK)) throw Error();
      apk = publicJwk(JSON.parse(env.APK_PUBLIC_JWK));
      apkKey = await crypto.subtle.importKey('jwk', apk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      apkId = await fingerprint(apk);
      if (apkId === keyId) throw Error();
    } catch { throw new Failure(503, 'INVALID_APK_CONFIGURATION'); }
    scope.check();
    if (request.headers.get('x-maya-key-id') !== apkId) throw new Failure(401, 'SIGNATURE_REQUIRED');
    key = apkKey; keyId = apkId;
  }
  const timestampText = request.headers.get('x-maya-sent-at'), timestamp = Number(timestampText);
  const nonce = request.headers.get('x-maya-nonce'); let signature;
  try {
    if (!/^[1-9]\d{0,15}$/.test(timestampText ?? '') || !Number.isSafeInteger(timestamp)) throw Error();
    decode64(nonce, 24); signature = decode64(request.headers.get('x-maya-signature'), 64);
    if (request.headers.get('x-maya-key-id') !== keyId) throw Error();
  } catch { throw new Failure(401, 'SIGNATURE_REQUIRED'); }
  fresh(timestamp, clock.now());
  const bytes = await readBytes(request, scope, url.pathname === CHAT_PATH ? LIMITS.bodyBytes : 2048); scope.check();
  let valid;
  try {
    const bodyHash = await hash(bytes); scope.check();
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature,
      canonical({ origin: url.origin, path: url.pathname, timestamp, nonce, bodyHash, keyId }));
  } catch (error) { if (error instanceof Failure) throw error; throw new Failure(401, 'BAD_SIGNATURE'); }
  scope.check(); fresh(timestamp, clock.now());
  if (!valid) throw new Failure(401, 'BAD_SIGNATURE');
  let value, messages;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Failure(400, 'INVALID_JSON'); }
  if (url.pathname === CHAT_PATH) messages = validateMessages(value);
  else if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length) throw new Failure(400, 'EMPTY_CHECK_REQUIRED');
  let result;
  try {
    result = await env.DB.batch([
      env.DB.prepare(PRUNE).bind(clock.now()),
      env.DB.prepare(CLAIM).bind(keyId, nonce, timestamp + PAST_MS),
    ]);
  } catch { throw new Failure(503, 'REPLAY_STORE_UNAVAILABLE'); }
  scope.check(); fresh(timestamp, clock.now());
  if (!Array.isArray(result) || result.length !== 2 || result.some(r => r?.success !== true)
      || !Array.isArray(result[1].results)) throw new Failure(503, 'REPLAY_STORE_UNAVAILABLE');
  if (result[1].results.length !== 1 || result[1].results[0]?.nonce !== nonce) throw new Failure(409, 'REPLAY_OR_WINDOW_FULL');
  return { keyId, nonce, messages };
}
