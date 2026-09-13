// Separate domain from pairing-v1; signatures cannot be repurposed as chat.
import { base64url, fingerprint, hash } from '../pairing/shared.mjs';
export const PROTOCOL = 'maya-text-chat-v1';
export const CHAT_PATH = '/v1/chat';
export const CHECK_PATH = '/v1/chat/check';
export function canonical({ origin, path, timestamp, nonce, bodyHash, keyId }) {
  return new TextEncoder().encode([PROTOCOL, 'POST', origin, path, String(timestamp), nonce, bodyHash, keyId].join('\n'));
}
export async function signChat(record, origin, body, { path = CHAT_PATH, timestamp = Date.now(),
  nonce = base64url(crypto.getRandomValues(new Uint8Array(24))) } = {}) {
  if (new URL(origin).origin !== origin || !origin.startsWith('https://')
      || ![CHAT_PATH, CHECK_PATH].includes(path) || typeof body !== 'string') throw Error('INVALID_TARGET');
  const keyId = await fingerprint(record.publicJwk);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, record.privateKey,
    canonical({ origin, path, timestamp, nonce, keyId, bodyHash: await hash(new TextEncoder().encode(body)) }));
  return { method: 'POST', body, headers: {
    'Content-Type': 'application/json', 'X-Maya-Key-Id': keyId,
    'X-Maya-Sent-At': String(timestamp), 'X-Maya-Nonce': nonce, 'X-Maya-Signature': base64url(signature),
  } };
}
