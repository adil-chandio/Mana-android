import { ASSETS } from './assets.generated.mjs';
import { Fault, bounded, defaultClock } from './deadline.mjs';
import { verifyPairing } from './auth.mjs';
import { PATH } from './shared.mjs';
const security = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",
};
function json(data, status = 200) { return Response.json(data, { status, headers: security }); }
export function createPairingHandler({ clock = defaultClock } = {}) {
  return async function fetch(request, env = {}) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && !url.search && ASSETS[url.pathname]) {
        const [type, text] = ASSETS[url.pathname];
        return new Response(text, { headers: { ...security, 'Content-Type': type } });
      }
      if (request.method === 'GET' && url.pathname === '/health') return json({ service: 'maya-pairing-only', aiConnected: false, authenticationVerified: false });
      if (url.pathname !== PATH) return json({ error: { code: 'NOT_FOUND' } }, 404);
      if (request.method !== 'POST') return json({ error: { code: 'POST_ONLY' } }, 405);
      return await bounded(request, clock, async scope => {
        const { keyId } = await verifyPairing(request, env, scope, clock); scope.check();
        return json({ kind: 'pairing-verified', keyId, nonce: request.headers.get('x-maya-nonce'), aiConnected: false });
      });
    } catch (error) {
      const safe = error instanceof Fault ? error : new Fault(503, 'VERIFICATION_UNAVAILABLE');
      return json({ error: { code: safe.code, automaticRetry: false }, aiConnected: false }, safe.status);
    } finally {
      if (request.body && !request.body.locked) request.body.cancel().catch(() => {});
    }
  };
}
export default { fetch: createPairingHandler() };
