// Shared, versioned wire format. Private keys are never serialized here.
export const PROTOCOL = 'maya-browser-pairing-v1';
export const PATH = '/v1/pairing/check';
export const PAST_MS = 60_000;
export const FUTURE_MS = 10_000;
export function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decode64(text, length) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text) || text.length !== Math.ceil(length * 4 / 3)) throw Error('INVALID_ENCODING');
  const data = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
  if (data.length !== length || base64url(data) !== text) throw Error('INVALID_ENCODING');
  return data;
}
export function publicJwk(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(k => !['kty', 'crv', 'x', 'y'].includes(k))
      || value.kty !== 'EC' || value.crv !== 'P-256') throw Error('INVALID_PUBLIC_KEY');
  decode64(value.x, 32); decode64(value.y, 32);
  // RFC 7638 canonical public members. No d, extractability or key_ops accepted.
  return { crv: 'P-256', kty: 'EC', x: value.x, y: value.y };
}
export async function hash(bytes) { return base64url(await crypto.subtle.digest('SHA-256', bytes)); }
export async function fingerprint(jwk) { return hash(new TextEncoder().encode(JSON.stringify(publicJwk(jwk)))); }
export function canonical({ method, origin, path, timestamp, nonce, bodyHash, keyId }) {
  return new TextEncoder().encode([PROTOCOL, method, origin, path, String(timestamp), nonce, bodyHash, keyId].join('\n'));
}
export async function signRequest(record, origin, body = '{}', { timestamp = Date.now(), nonce = base64url(crypto.getRandomValues(new Uint8Array(24))), path = PATH } = {}) {
  const bytes = new TextEncoder().encode(body);
  const keyId = await fingerprint(record.publicJwk);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, record.privateKey,
    canonical({ method: 'POST', origin, path, timestamp, nonce, bodyHash: await hash(bytes), keyId }));
  return { method: 'POST', body, headers: {
    'Content-Type': 'application/json', 'X-Maya-Key-Id': keyId,
    'X-Maya-Sent-At': String(timestamp), 'X-Maya-Nonce': nonce, 'X-Maya-Signature': base64url(signature),
  } };
}
