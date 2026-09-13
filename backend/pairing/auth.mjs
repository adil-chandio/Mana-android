import { publicJwk, fingerprint, canonical, decode64, hash, PATH, PAST_MS, FUTURE_MS } from './shared.mjs';
import { Fault } from './deadline.mjs';

export const NONCE_CAP = 256;
export const PRUNE = 'DELETE FROM pairing_nonces WHERE expires_at < ?';
export const CLAIM = `INSERT INTO pairing_nonces (key_id, nonce, expires_at)
  SELECT ?, ?, ? WHERE (SELECT count(*) FROM pairing_nonces) < ${NONCE_CAP}
  ON CONFLICT (key_id, nonce) DO NOTHING RETURNING nonce`;

function freshness(timestamp, now) {
  if (timestamp < now - PAST_MS || timestamp > now + FUTURE_MS) throw new Fault(401, 'REQUEST_EXPIRED_OR_CLOCK_SKEW');
}
async function bodyBytes(request, scope) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
      || ![null, 'identity'].includes(request.headers.get('content-encoding'))) throw new Fault(415, 'JSON_ONLY');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 2_048)) throw new Fault(413, 'BODY_TOO_LARGE');
  if (!request.body) throw new Fault(400, 'EMPTY_CHECK_REQUIRED');
  const reader = request.body.getReader(), chunks = []; let size = 0;
  scope.onClose(() => { reader.cancel().catch(() => {}); });
  try {
    while (true) {
      const { done, value } = await reader.read(); scope.check();
      if (done) break;
      size += value.byteLength;
      if (size > 2_048) { reader.cancel().catch(() => {}); throw new Fault(413, 'BODY_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

// Only the Cloudflare account administrator registers OWNER_PUBLIC_JWK in the
// dashboard. There is intentionally NO public registration or replace-key API.
export async function verifyPairing(request, env, scope, clock) {
  const url = new URL(request.url);
  if (env.PAIRING_ENABLED !== 'true' || !env.APP_ORIGIN || !env.OWNER_PUBLIC_JWK || !env.DB?.batch) throw new Fault(503, 'SETUP_REQUIRED');
  if (env.APP_ORIGIN !== url.origin || url.protocol !== 'https:' || request.headers.get('origin') !== url.origin
      || url.search || url.hash || url.pathname !== PATH || request.method !== 'POST') throw new Fault(403, 'ORIGIN_OR_TARGET_DENIED');
  let owner, key;
  try {
    if (typeof env.OWNER_PUBLIC_JWK !== 'string' || env.OWNER_PUBLIC_JWK.length > 512) throw Error();
    owner = publicJwk(JSON.parse(env.OWNER_PUBLIC_JWK));
    key = await crypto.subtle.importKey('jwk', owner, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  } catch { throw new Fault(503, 'INVALID_OWNER_CONFIGURATION'); }
  scope.check();
  const keyId = await fingerprint(owner); scope.check();
  const timestampText = request.headers.get('x-maya-sent-at'), nonce = request.headers.get('x-maya-nonce');
  const timestamp = Number(timestampText);
  let signature;
  try {
    if (!/^[1-9]\d{0,15}$/.test(timestampText ?? '') || !Number.isSafeInteger(timestamp)) throw Error();
    decode64(nonce, 24); signature = decode64(request.headers.get('x-maya-signature'), 64);
    if (request.headers.get('x-maya-key-id') !== keyId) throw Error();
  } catch { throw new Fault(401, 'SIGNATURE_REQUIRED'); }
  freshness(timestamp, clock.now());
  const bytes = await bodyBytes(request, scope); scope.check();
  let valid;
  try {
    const bodyHash = await hash(bytes); scope.check();
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature,
      canonical({ method: 'POST', origin: url.origin, path: PATH, timestamp, nonce, bodyHash, keyId }));
  } catch (error) { if (error instanceof Fault) throw error; throw new Fault(401, 'BAD_SIGNATURE'); }
  scope.check(); freshness(timestamp, clock.now());
  if (!valid) throw new Fault(401, 'BAD_SIGNATURE');
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length) throw Error();
  } catch { throw new Fault(400, 'EMPTY_CHECK_REQUIRED'); }
  let result;
  try {
    // D1 batch is transactional. Duplicate races are serialized by the UNIQUE key.
    result = await env.DB.batch([
      env.DB.prepare(PRUNE).bind(clock.now()),
      env.DB.prepare(CLAIM).bind(keyId, nonce, timestamp + PAST_MS),
    ]);
  } catch { throw new Fault(503, 'REPLAY_STORE_UNAVAILABLE'); }
  scope.check(); freshness(timestamp, clock.now());
  if (!Array.isArray(result) || result.length !== 2 || result.some(r => r.success !== true)
      || !Array.isArray(result[1].results)) throw new Fault(503, 'REPLAY_STORE_UNAVAILABLE');
  if (result[1].results.length !== 1 || result[1].results[0].nonce !== nonce) throw new Fault(409, 'REPLAY_OR_WINDOW_FULL');
  return { keyId };
}
